/**
 * Admin IAM Management Router — cpa-manage-backend.
 * Root-only routes for creating worker admins and managing permissions.
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/db');
const { AppError } = require('../utils/errors');
const requirePermission = require('../middleware/requirePermission');
const { writeAuditLog } = require('../middleware/auditLog');

// ─── GET /admin/admins ─────────────────────────────────────────────────────────
router.get('/', requirePermission.rootOnly, async (req, res, next) => {
  try {
    const { rows: admins } = await query(
      `SELECT id, email, display_name, is_root, status, created_at, last_login_at
       FROM admin_users ORDER BY created_at ASC`
    );

    const { rows: perms } = await query(
      `SELECT admin_user_id, permission_key FROM admin_user_permissions`
    );

    const permMap = {};
    perms.forEach(p => {
      if (!permMap[p.admin_user_id]) permMap[p.admin_user_id] = [];
      permMap[p.admin_user_id].push(p.permission_key);
    });

    const result = admins.map(a => ({
      ...a,
      permissions: a.is_root ? ['*'] : (permMap[a.id] || []),
    }));

    res.json({ admins: result });
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/admins ────────────────────────────────────────────────────────
router.post('/', requirePermission.rootOnly, async (req, res, next) => {
  const client = await getClient();
  try {
    const { email, display_name, password, permissions = [] } = req.body;

    if (!email || !display_name || !password) {
      return next(new AppError('VALIDATION_ERROR', 400, { fields: { email: !email ? 'required' : undefined, display_name: !display_name ? 'required' : undefined, password: !password ? 'required' : undefined } }));
    }

    const { rows: existing } = await query('SELECT id FROM admin_users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return next(new AppError('CONFLICT', 409, null, 'An admin with this email already exists.'));
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO admin_users (email, password_hash, display_name, is_root, status, created_by)
       VALUES ($1, $2, $3, false, 'active', $4)
       RETURNING id, email, display_name, is_root, status, created_at`,
      [email.toLowerCase().trim(), passwordHash, display_name, req.adminUser.id]
    );

    const newAdmin = rows[0];

    // Filter out root-only permission if present
    const validPerms = (Array.isArray(permissions) ? permissions : []).filter(p => p !== 'admin.manage');

    for (const key of validPerms) {
      await client.query(
        `INSERT INTO admin_user_permissions (admin_user_id, permission_key, granted_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (admin_user_id, permission_key) DO NOTHING`,
        [newAdmin.id, key, req.adminUser.id]
      );
    }

    // Same-transaction audit log (Ground Rule 6)
    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: true,
      permissionUsed: 'admin.manage',
      module: 'admin',
      action: 'admin.create',
      targetType: 'admin_user',
      targetId: String(newAdmin.id),
      reason: `Created worker admin account for ${email} with permissions [${validPerms.join(', ')}]`,
    });

    await client.query('COMMIT');

    res.status(201).json({ admin_user: { ...newAdmin, permissions: validPerms } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── PATCH /admin/admins/:id/permissions ───────────────────────────────────────
router.patch('/:id/permissions', requirePermission.rootOnly, async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { grant = [], revoke = [] } = req.body;

    // Hard reject any attempt to grant admin.manage
    if (grant.includes('admin.manage')) {
      return next(new AppError('FORBIDDEN', 403, null, 'admin.manage permission is root-only and non-assignable.'));
    }

    const { rows } = await query('SELECT id, email, is_root FROM admin_users WHERE id::text = $1', [id]);
    if (rows.length === 0) {
      return next(new AppError('NOT_FOUND', 404));
    }

    const targetAdmin = rows[0];
    if (targetAdmin.is_root) {
      return next(new AppError('CONFLICT', 409, null, 'Cannot modify permissions for a root administrator account.'));
    }

    await client.query('BEGIN');

    // Grant permissions
    for (const key of grant) {
      await client.query(
        `INSERT INTO admin_user_permissions (admin_user_id, permission_key, granted_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (admin_user_id, permission_key) DO NOTHING`,
        [targetAdmin.id, key, req.adminUser.id]
      );
    }

    // Revoke permissions
    if (revoke.length > 0) {
      await client.query(
        `DELETE FROM admin_user_permissions
         WHERE admin_user_id = $1 AND permission_key = ANY($2)`,
        [targetAdmin.id, revoke]
      );
    }

    // Same-transaction audit log
    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: true,
      permissionUsed: 'admin.manage',
      module: 'admin',
      action: 'admin.permissions_update',
      targetType: 'admin_user',
      targetId: String(targetAdmin.id),
      reason: `Granted [${grant.join(', ')}], Revoked [${revoke.join(', ')}]`,
    });

    await client.query('COMMIT');

    const { rows: updatedPerms } = await query(
      'SELECT permission_key FROM admin_user_permissions WHERE admin_user_id = $1',
      [targetAdmin.id]
    );

    res.json({
      admin_user_id: targetAdmin.id,
      permissions: updatedPerms.map(r => r.permission_key),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
