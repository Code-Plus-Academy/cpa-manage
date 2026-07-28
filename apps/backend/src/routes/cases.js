/**
 * Admin Support Cases & Tickets Router — cpa-manage-backend.
 * Enforces row-level permission filtering and same-transaction audit logging.
 */
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/db');
const { AppError } = require('../utils/errors');
const requirePermission = require('../middleware/requirePermission');
const { writeAuditLog } = require('../middleware/auditLog');
const contentActionsClient = require('../grpc/client');

// Helper to determine allowed ticket types based on admin permissions
function getAllowedTicketTypes(adminUser) {
  if (adminUser.is_root) return null; // Null means all types allowed

  const allowedTypes = [];
  const perms = adminUser.permissions || [];

  if (perms.some(p => p.startsWith('support.'))) {
    allowedTypes.push('general-support', 'harassment', 'privacy-access', 'privacy-correction', 'privacy-erasure');
  }
  if (perms.some(p => p.startsWith('claims.copyright.'))) {
    allowedTypes.push('copyright');
  }
  if (perms.some(p => p.startsWith('claims.institution.'))) {
    allowedTypes.push('institution_claim');
  }
  if (perms.some(p => p.startsWith('claims.reclaim.'))) {
    allowedTypes.push('ownership_transfer');
  }

  return allowedTypes;
}

// ─── GET /admin/cases ──────────────────────────────────────────────────────────
router.get(
  '/',
  requirePermission.any([
    'support.view',
    'claims.copyright.view',
    'claims.institution.view',
    'claims.reclaim.view',
  ]),
  async (req, res, next) => {
    try {
      const allowedTypes = getAllowedTicketTypes(req.adminUser);

      // If worker has no matching view permissions for any category
      if (allowedTypes && allowedTypes.length === 0) {
        return res.json({ cases: [], pagination: { page: 1, limit: 20, total_count: 0 } });
      }

      const { type, status, source_surface, assigned_to_me, page = 1, limit = 20 } = req.query;
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));

      const conditions = [];
      const values = [];
      let idx = 1;

      // Row-level permission filtering (Ground Rule 5)
      if (allowedTypes) {
        conditions.push(`type = ANY($${idx++})`);
        values.push(allowedTypes);
      }

      if (type) {
        // If type specified, verify worker holds permission for it
        if (allowedTypes && !allowedTypes.includes(type)) {
          return res.json({ cases: [], pagination: { page: 1, limit: 20, total_count: 0 } });
        }
        conditions.push(`type = $${idx++}`);
        values.push(type);
      }

      if (status) {
        conditions.push(`status = $${idx++}`);
        values.push(status);
      }

      if (source_surface) {
        conditions.push(`source_surface = $${idx++}`);
        values.push(source_surface);
      }

      if (assigned_to_me === 'true') {
        conditions.push(`assigned_admin_id = $${idx++}`);
        values.push(req.adminUser.id);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await query(`SELECT COUNT(*)::int as total FROM support_tickets ${whereClause}`, values);
      const totalCount = countRes.rows[0]?.total || 0;

      values.push(Math.min(100, parseInt(limit, 10)));
      values.push(offset);

      const { rows } = await query(
        `SELECT * FROM support_tickets ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        values
      );

      res.json({
        cases: rows,
        pagination: {
          page: Math.max(1, parseInt(page, 10)),
          limit: Math.min(100, parseInt(limit, 10)),
          total_count: totalCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /admin/cases/:id ──────────────────────────────────────────────────────
router.get(
  '/:id',
  requirePermission.any([
    'support.view',
    'claims.copyright.view',
    'claims.institution.view',
    'claims.reclaim.view',
  ]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { rows } = await query('SELECT * FROM support_tickets WHERE id::text = $1', [id]);

      if (rows.length === 0) {
        return next(new AppError('NOT_FOUND', 404));
      }

      const ticket = rows[0];
      const allowedTypes = getAllowedTicketTypes(req.adminUser);

      // Return 404 (not 403) if caller does not hold permission for this ticket type to prevent leaking existence
      if (allowedTypes && !allowedTypes.includes(ticket.type)) {
        return next(new AppError('NOT_FOUND', 404));
      }

      const { rows: actions } = await query(
        'SELECT * FROM ticket_actions WHERE ticket_id = $1 ORDER BY created_at ASC',
        [ticket.id]
      );

      const { rows: appeals } = await query(
        'SELECT * FROM appeals WHERE ticket_id = $1 ORDER BY created_at DESC',
        [ticket.id]
      );

      let contentSummary = null;
      if (ticket.content_id && ticket.content_type) {
        try {
          contentSummary = await contentActionsClient.getContentSummary({
            content_type: ticket.content_type,
            content_id: String(ticket.content_id),
          });
        } catch (grpcErr) {
          console.warn('[gRPC GetContentSummary Error]:', grpcErr.message);
        }
      }

      res.json({ ticket, actions, appeals, content_summary: contentSummary });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /admin/cases/:id/action ────────────────────────────────────────────
router.patch(
  '/:id/action',
  async (req, res, next) => {
    const client = await getClient();
    try {
      const { id } = req.params;
      const { action_type, reason, issue_strike } = req.body;

      if (!action_type || !reason) {
        return next(new AppError('VALIDATION_ERROR', 400, { fields: { action_type: !action_type ? 'required' : undefined, reason: !reason ? 'required' : undefined } }));
      }

      const { rows } = await query('SELECT * FROM support_tickets WHERE id::text = $1', [id]);
      if (rows.length === 0) {
        return next(new AppError('NOT_FOUND', 404));
      }

      const ticket = rows[0];

      // Permission mapping check
      let requiredPerm = null;
      if (['acknowledge', 'dismiss', 'close'].includes(action_type)) {
        requiredPerm = 'support.respond';
      } else if (action_type === 'remove_content') {
        requiredPerm = 'content.remove';
      } else if (action_type === 'approve_claim' && ticket.type === 'copyright') {
        requiredPerm = 'claims.copyright.approve';
      } else if (action_type === 'reject_claim' && ticket.type === 'copyright') {
        requiredPerm = 'claims.copyright.dismiss';
      } else if (action_type === 'approve_claim' && ticket.type === 'institution_claim') {
        requiredPerm = 'claims.institution.approve';
      } else if (action_type === 'reject_claim' && ticket.type === 'institution_claim') {
        requiredPerm = 'claims.institution.reject';
      } else if (action_type === 'transfer_ownership') {
        requiredPerm = 'claims.reclaim.approve';
      }

      if (!req.adminUser.is_root && requiredPerm && !req.adminUser.permissions.includes(requiredPerm)) {
        return next(new AppError('PERMISSION_DENIED', 403, { required: requiredPerm }));
      }

      if (issue_strike && !req.adminUser.is_root && !req.adminUser.permissions.includes('users.strike')) {
        return next(new AppError('PERMISSION_DENIED', 403, { required: 'users.strike' }));
      }

      // Map ticket status
      let newStatus = ticket.status;
      if (action_type === 'acknowledge') newStatus = 'acknowledged';
      else if (['remove_content', 'approve_claim', 'transfer_ownership'].includes(action_type)) newStatus = 'action_taken';
      else if (['dismiss', 'reject_claim'].includes(action_type)) newStatus = 'dismissed';
      else if (action_type === 'close') newStatus = 'closed';

      // Execute inside SINGLE DB transaction (Ground Rule 6)
      await client.query('BEGIN');

      await client.query(
        'UPDATE support_tickets SET status = $1, assigned_admin_id = $2, updated_at = NOW() WHERE id = $3',
        [newStatus, req.adminUser.id, ticket.id]
      );

      const { rows: actionRows } = await client.query(
        `INSERT INTO ticket_actions (ticket_id, admin_id, action_type, reason, issued_strike)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [ticket.id, req.adminUser.id, action_type, reason, !!issue_strike]
      );

      // Ground Rule 6: Audit log write MUST be in the SAME transaction
      await writeAuditLog(client, {
        actorAdminId: req.adminUser.id,
        actorIsRoot: req.adminUser.is_root,
        permissionUsed: requiredPerm,
        module: 'support',
        action: `cases.${action_type}`,
        targetType: 'ticket',
        targetId: String(ticket.id),
        reason,
        metadata: { issue_strike: !!issue_strike, new_status: newStatus },
      });

      await client.query('COMMIT');

      // gRPC content status update if content removal approved
      if (['remove_content', 'approve_claim'].includes(action_type) && ticket.content_id && ticket.content_type) {
        try {
          await contentActionsClient.setContentStatus({
            ref: { content_type: ticket.content_type, content_id: String(ticket.content_id) },
            new_status: 'removed',
            reason,
            actor_admin_id: req.adminUser.id,
          });
        } catch (grpcErr) {
          console.warn('[gRPC SetContentStatus call failed]:', grpcErr.message);
        }
      }

      res.json({ ticket: { ...ticket, status: newStatus }, action: actionRows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
