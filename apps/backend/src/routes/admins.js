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
const { sendMail } = require('../services/emailService');

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

    // Generate 6-digit OTP for Worker Admin registration workflow
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO admin_users (email, password_hash, display_name, is_root, status, registration_otp, registration_otp_expires_at, created_by)
       VALUES ($1, $2, $3, false, 'pending_verification', $4, $5, $6)
       RETURNING id, email, display_name, is_root, status, created_at`,
      [email.toLowerCase().trim(), passwordHash, display_name, otpCode, otpExpiresAt, req.adminUser.id]
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

    // Fetch customizable template from email_templates table if available
    let subject = `[Code+ Academy] Complete Your Worker Admin Registration - Verification OTP: ${otpCode}`;
    let bodyHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #6366f1;">Worker Admin Account Registration</h2>
        <p>Hello ${display_name},</p>
        <p>You have been invited to join the Code+ Academy Administration console as a Worker Admin.</p>
        <p>Your 6-digit One-Time Registration Passcode (OTP) is:</p>
        <div style="background: #1e1b4b; color: #818cf8; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 14px 20px; border-radius: 8px; display: inline-block; margin: 12px 0;">
          ${otpCode}
        </div>
        <p style="font-size: 12px; color: #6b7280;">This OTP will expire in 15 minutes.</p>
        <p>Best regards,<br/>Code+ Academy Administration</p>
      </div>
    `;

    const { rows: tplRows } = await client.query(
      `SELECT subject_template, body_html_template FROM email_templates WHERE key = 'admin_registration_otp' AND is_active = true`
    );

    if (tplRows.length > 0) {
      const { subject_template, body_html_template } = tplRows[0];
      subject = subject_template
        .replace(/\{\{\s*display_name\s*\}\}/g, display_name)
        .replace(/\{\{\s*otp_code\s*\}\}/g, otpCode)
        .replace(/\{\{\s*expires_minutes\s*\}\}/g, '15');

      bodyHtml = body_html_template
        .replace(/\{\{\s*display_name\s*\}\}/g, display_name)
        .replace(/\{\{\s*otp_code\s*\}\}/g, otpCode)
        .replace(/\{\{\s*expires_minutes\s*\}\}/g, '15');
    }

    await client.query(
      `INSERT INTO email_sends (template_key, user_id, recipient_email, subject, body_html, status, sent_at)
       VALUES ('admin_registration_otp', $1, $2, $3, $4, 'sent', NOW())`,
      [newAdmin.id, email.toLowerCase().trim(), subject, bodyHtml]
    );

    // Same-transaction audit log (Ground Rule 6)
    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: true,
      permissionUsed: 'admin.manage',
      module: 'admin',
      action: 'admin.create_otp_sent',
      targetType: 'admin_user',
      targetId: String(newAdmin.id),
      reason: `Created worker admin account for ${email} (status: pending_verification, OTP sent)`,
    });

    await client.query('COMMIT');

    // Asynchronously compile customizable template from DB & dispatch physical email via Resend API
    const { sendTemplatedEmail } = require('../services/emailTemplateCompiler');
    sendTemplatedEmail({
      templateKey: 'admin_registration_otp',
      recipientEmail: email.toLowerCase().trim(),
      payload: {
        display_name,
        name: display_name,
        otp_code: otpCode,
        expiry_minutes: '15',
        expires_minutes: '15',
      },
      userId: newAdmin.id,
    }).then(ok => {
      console.log(`[admins.js] sendTemplatedEmail result for ${email}: ${ok ? 'SUCCESS' : 'FAILED'}`);
    }).catch(err => console.error('[admins.js] Exception in sendTemplatedEmail:', err));

    res.status(201).json({
      admin_user: { ...newAdmin, permissions: validPerms },
      otp_sent: true,
      message: `Worker admin invited. Registration OTP sent to ${email}.`,
    });
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

// ─── PUT /admin/admins/:id/permissions (Overwrite permissions) ──────────────────
router.put('/:id/permissions', requirePermission.rootOnly, async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { permissions = [] } = req.body;

    const { rows } = await query('SELECT id, email, is_root FROM admin_users WHERE id::text = $1', [id]);
    if (rows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Admin user not found.'));
    }

    const targetAdmin = rows[0];
    if (targetAdmin.is_root) {
      return next(new AppError('CONFLICT', 409, null, 'Cannot modify permissions for a root administrator account.'));
    }

    const validPerms = (Array.isArray(permissions) ? permissions : []).filter(p => p !== 'admin.manage');

    await client.query('BEGIN');

    // Wipe existing permissions
    await client.query('DELETE FROM admin_user_permissions WHERE admin_user_id = $1', [targetAdmin.id]);

    // Insert new set of permissions
    for (const key of validPerms) {
      await client.query(
        `INSERT INTO admin_user_permissions (admin_user_id, permission_key, granted_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (admin_user_id, permission_key) DO NOTHING`,
        [targetAdmin.id, key, req.adminUser.id]
      );
    }

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: true,
      permissionUsed: 'admin.manage',
      module: 'admin',
      action: 'admin.permissions_set',
      targetType: 'admin_user',
      targetId: String(targetAdmin.id),
      reason: `Set permissions to [${validPerms.join(', ')}]`,
    });

    await client.query('COMMIT');

    res.json({
      admin_user_id: targetAdmin.id,
      permissions: validPerms,
      message: 'Worker admin permissions updated successfully.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── DELETE /admin/admins/:id (Delete worker admin) ────────────────────────────
router.delete('/:id', requirePermission.rootOnly, async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;

    const { rows } = await query('SELECT id, email, is_root FROM admin_users WHERE id::text = $1', [id]);
    if (rows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Admin user not found.'));
    }

    const targetAdmin = rows[0];
    if (targetAdmin.is_root) {
      return next(new AppError('FORBIDDEN', 403, null, 'Root administrator account cannot be deleted.'));
    }

    if (targetAdmin.id === req.adminUser.id) {
      return next(new AppError('CONFLICT', 409, null, 'You cannot delete your own admin account while logged in.'));
    }

    await client.query('BEGIN');

    // Delete permissions and admin user
    await client.query('DELETE FROM admin_user_permissions WHERE admin_user_id = $1', [targetAdmin.id]);
    await client.query('DELETE FROM admin_sessions WHERE admin_user_id = $1', [targetAdmin.id]);
    await client.query('DELETE FROM admin_users WHERE id = $1', [targetAdmin.id]);

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: true,
      permissionUsed: 'admin.manage',
      module: 'admin',
      action: 'admin.delete_account',
      targetType: 'admin_user',
      targetId: String(targetAdmin.id),
      reason: `Deleted worker admin account for ${targetAdmin.email}`,
    });

    await client.query('COMMIT');

    res.json({ message: `Worker admin account ${targetAdmin.email} deleted successfully.` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
