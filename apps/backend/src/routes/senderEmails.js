/**
 * Sender Email Management Router — cpa-manage backend.
 * Managing verified sender email addresses, setting platform defaults,
 * and binding custom sender emails to email templates.
 */
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/db');
const { AppError } = require('../utils/errors');
const requirePermission = require('../middleware/requirePermission');
const { writeAuditLog } = require('../middleware/auditLog');

// GET /admin/sender-emails — List all sender email addresses
router.get('/', requirePermission.any(['email.templates.edit', 'email.analytics.view', 'support.view']), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, a.display_name as added_by_name
       FROM sender_emails s
       LEFT JOIN admin_users a ON s.added_by = a.id
       ORDER BY s.is_default DESC, s.created_at ASC`
    );
    res.json({ sender_emails: rows });
  } catch (err) {
    next(err);
  }
});

// POST /admin/sender-emails — Add new sender address
router.post('/', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { email, display_name, is_default } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return next(new AppError('VALIDATION_ERROR', 400, null, 'Valid email address is required.'));
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = (display_name || '').trim();

    const { rows: existing } = await query('SELECT id FROM sender_emails WHERE email = $1', [cleanEmail]);
    if (existing.length > 0) {
      return next(new AppError('CONFLICT', 409, null, 'Sender email address already exists.'));
    }

    await client.query('BEGIN');

    // If marked as default, unset existing default
    if (is_default) {
      await client.query('UPDATE sender_emails SET is_default = false WHERE is_default = true');
    }

    const { rows } = await client.query(
      `INSERT INTO sender_emails (email, display_name, is_default, is_verified, added_by)
       VALUES ($1, $2, $3, true, $4)
       RETURNING *`,
      [cleanEmail, cleanDisplayName, !!is_default, req.adminUser.id]
    );

    const newSender = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.templates.edit',
      module: 'email',
      action: 'sender_email.create',
      targetType: 'sender_email',
      targetId: newSender.id,
      reason: `Added sender email address ${cleanEmail}`,
    });

    await client.query('COMMIT');

    res.status(201).json({ sender_email: newSender });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /admin/sender-emails/:id — Update sender address details
router.patch('/:id', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { display_name } = req.body;

    const { rows: existingRows } = await query('SELECT * FROM sender_emails WHERE id = $1', [id]);
    if (existingRows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Sender email address not found.'));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE sender_emails
       SET display_name = COALESCE($1, display_name),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [display_name !== undefined ? display_name.trim() : null, id]
    );

    const updatedSender = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.templates.edit',
      module: 'email',
      action: 'sender_email.update',
      targetType: 'sender_email',
      targetId: id,
      reason: `Updated sender email address ${updatedSender.email}`,
    });

    await client.query('COMMIT');

    res.json({ sender_email: updatedSender });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /admin/sender-emails/:id/set-default — Mark sender as system default
router.post('/:id/set-default', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;

    const { rows: existingRows } = await query('SELECT * FROM sender_emails WHERE id = $1', [id]);
    if (existingRows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Sender email address not found.'));
    }

    await client.query('BEGIN');

    // Step 1: Clear existing default
    await client.query('UPDATE sender_emails SET is_default = false WHERE is_default = true');

    // Step 2: Set new default
    const { rows } = await client.query(
      `UPDATE sender_emails
       SET is_default = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const defaultSender = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.templates.edit',
      module: 'email',
      action: 'sender_email.set_default',
      targetType: 'sender_email',
      targetId: id,
      reason: `Set ${defaultSender.email} as system default sender address`,
    });

    await client.query('COMMIT');

    res.json({ sender_email: defaultSender, message: `${defaultSender.email} is now the default sender address.` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /admin/sender-emails/:id — Remove a sender address
router.delete('/:id', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;

    const { rows: existingRows } = await query('SELECT * FROM sender_emails WHERE id = $1', [id]);
    if (existingRows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Sender email address not found.'));
    }

    const target = existingRows[0];
    if (target.is_default) {
      return next(new AppError('FORBIDDEN', 403, null, 'Cannot delete the system default sender address. Set another address as default first.'));
    }

    await client.query('BEGIN');

    await client.query('DELETE FROM sender_emails WHERE id = $1', [id]);

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.templates.edit',
      module: 'email',
      action: 'sender_email.delete',
      targetType: 'sender_email',
      targetId: id,
      reason: `Deleted sender email address ${target.email}`,
    });

    await client.query('COMMIT');

    res.json({ success: true, message: `Sender email ${target.email} removed.` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
