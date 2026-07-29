/**
 * Admin User Moderation Router — cpa-manage-backend.
 * Handles strikes, suspensions, and bans with same-transaction audit logging.
 */
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/db');
const { AppError } = require('../utils/errors');
const requirePermission = require('../middleware/requirePermission');
const { writeAuditLog } = require('../middleware/auditLog');

// ─── GET /admin/users ──────────────────────────────────────────────────────────
router.get('/', requirePermission('users.reports.view'), async (req, res, next) => {
  try {
    const { rows: strikes } = await query(
      `SELECT user_id, COUNT(*)::int as strike_count, MAX(created_at) as last_strike_at
       FROM strikes GROUP BY user_id`
    );

    const { rows: suspensions } = await query(
      `SELECT DISTINCT ON (user_id) user_id, status, reason, suspended_until, created_at
       FROM suspensions ORDER BY user_id, created_at DESC`
    );

    const { rows: reports } = await query(
      `SELECT user_id, COUNT(*)::int as report_count
       FROM support_tickets WHERE type IN ('harassment', 'user_report', 'impersonation')
       GROUP BY user_id`
    );

    const userMap = {};

    strikes.forEach(s => {
      if (!userMap[s.user_id]) userMap[s.user_id] = { user_id: s.user_id, strike_count: 0, moderation_status: 'active', report_count: 0, last_action_at: null };
      userMap[s.user_id].strike_count = s.strike_count;
      userMap[s.user_id].last_action_at = s.last_strike_at;
    });

    suspensions.forEach(s => {
      if (!userMap[s.user_id]) userMap[s.user_id] = { user_id: s.user_id, strike_count: 0, moderation_status: 'active', report_count: 0, last_action_at: null };
      userMap[s.user_id].moderation_status = s.status;
      userMap[s.user_id].suspended_until = s.suspended_until;
      userMap[s.user_id].suspension_reason = s.reason;
    });

    reports.forEach(r => {
      if (!userMap[r.user_id]) userMap[r.user_id] = { user_id: r.user_id, strike_count: 0, moderation_status: 'active', report_count: 0, last_action_at: null };
      userMap[r.user_id].report_count = r.report_count;
    });

    const userList = Object.values(userMap);
    res.json({ users: userList });
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/users/:id/strikes ──────────────────────────────────────────────
router.post('/:id/strikes', requirePermission('users.strike'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { reason, ticket_id } = req.body;

    if (!reason) {
      return next(new AppError('VALIDATION_ERROR', 400, { fields: { reason: 'required' } }));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO strikes (user_id, ticket_id, issued_by, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, ticket_id || null, req.adminUser.id, reason]
    );

    const strike = rows[0];

    // Same-transaction audit log (Ground Rule 6)
    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'users.strike',
      module: 'users',
      action: 'users.strike_issued',
      targetType: 'user',
      targetId: String(id),
      reason,
      metadata: { strike_id: strike.id, ticket_id: ticket_id || null },
    });

    await client.query('COMMIT');

    res.status(201).json({ strike });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── POST /admin/users/:id/suspend ──────────────────────────────────────────────
router.post('/:id/suspend', requirePermission('users.suspend'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { reason, until, ticket_id } = req.body;

    if (!reason) {
      return next(new AppError('VALIDATION_ERROR', 400, { fields: { reason: 'required' } }));
    }

    const suspendedUntil = until ? new Date(until) : null;

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO suspensions (user_id, ticket_id, suspended_by, reason, status, suspended_until)
       VALUES ($1, $2, $3, $4, 'suspended', $5)
       RETURNING *`,
      [id, ticket_id || null, req.adminUser.id, reason, suspendedUntil]
    );

    const suspension = rows[0];

    // Same-transaction audit log
    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'users.suspend',
      module: 'users',
      action: 'users.suspended',
      targetType: 'user',
      targetId: String(id),
      reason,
      metadata: { suspension_id: suspension.id, suspended_until: suspendedUntil },
    });

    await client.query('COMMIT');

    res.status(201).json({ suspension });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── POST /admin/users/:id/ban ──────────────────────────────────────────────────
router.post('/:id/ban', requirePermission('users.ban'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { reason, ticket_id } = req.body;

    if (!reason) {
      return next(new AppError('VALIDATION_ERROR', 400, { fields: { reason: 'required' } }));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO suspensions (user_id, ticket_id, suspended_by, reason, status, suspended_until)
       VALUES ($1, $2, $3, $4, 'banned', NULL)
       RETURNING *`,
      [id, ticket_id || null, req.adminUser.id, reason]
    );

    const ban = rows[0];

    // Same-transaction audit log
    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'users.ban',
      module: 'users',
      action: 'users.banned',
      targetType: 'user',
      targetId: String(id),
      reason,
      metadata: { ban_id: ban.id },
    });

    await client.query('COMMIT');

    res.status(201).json({ ban });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
