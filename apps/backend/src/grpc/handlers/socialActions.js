/**
 * SocialActions gRPC handler implementations for cpa-manage-backend.
 * Handles inter-service requests from cpa-main-backend to Social DB.
 */
const grpc = require('@grpc/grpc-js');
const { query } = require('../../config/db');

const socialActionsHandlers = {
  async createTicket(call, callback) {
    try {
      const {
        user_id,
        reporter_email,
        type,
        category,
        description,
        evidence_urls,
        content_type,
        content_id,
        source_surface,
      } = call.request || {};

      if (!type || !category || !description) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Type, category and description are required',
        });
      }

      const now = new Date();
      // Calculate SLA: 15 days for private_complainant
      const slaResolveBy = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      const { rows } = await query(
        `INSERT INTO support_tickets (
          user_id, reporter_email, type, case_source, category, description,
          evidence_urls, content_type, content_id, source_surface, status, sla_resolve_by
        ) VALUES ($1, $2, $3, 'private_complainant', $4, $5, $6, $7, $8, $9, 'open', $10)
        RETURNING id, sla_resolve_by`,
        [
          user_id || null,
          reporter_email || null,
          type,
          category,
          description,
          evidence_urls || [],
          content_type || null,
          content_id || null,
          source_surface || null,
          slaResolveBy,
        ]
      );

      const ticket = rows[0];

      callback(null, {
        ticket_id: String(ticket.id),
        sla_resolve_by: new Date(ticket.sla_resolve_by).toISOString(),
      });
    } catch (err) {
      console.error('[gRPC SocialActions.createTicket Error]', err);
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  },

  async getUserStanding(call, callback) {
    try {
      const { user_id } = call.request || {};
      if (!user_id) {
        return callback(null, {
          active_strikes: 0,
          suspension_status: 'none',
          suspension_until: '',
        });
      }

      // Count active strikes
      const strikeRes = await query(
        `SELECT COUNT(*)::int as count FROM strikes WHERE user_id::text = $1 AND is_active = true AND expires_at > NOW()`,
        [user_id]
      );
      const activeStrikes = strikeRes.rows[0]?.count || 0;

      // Check suspension status
      const suspRes = await query(
        `SELECT status, suspended_until FROM suspensions WHERE user_id::text = $1 AND status IN ('suspended', 'banned') ORDER BY created_at DESC LIMIT 1`,
        [user_id]
      );

      let suspensionStatus = 'none';
      let suspensionUntil = '';

      if (suspRes.rows.length > 0) {
        const s = suspRes.rows[0];
        suspensionStatus = s.status;
        suspensionUntil = s.suspended_until ? new Date(s.suspended_until).toISOString() : '';
      }

      callback(null, {
        active_strikes: activeStrikes,
        suspension_status: suspensionStatus,
        suspension_until: suspensionUntil,
      });
    } catch (err) {
      console.error('[gRPC SocialActions.getUserStanding Error]', err);
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  },

  async reportContent(call, callback) {
    try {
      const { reporter_user_id, content_type, content_id, source_surface, reason } = call.request || {};

      if (!content_type || !content_id) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Missing content_type or content_id',
        });
      }

      const now = new Date();
      const slaResolveBy = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      const { rows } = await query(
        `INSERT INTO support_tickets (
          user_id, type, case_source, category, description,
          content_type, content_id, source_surface, status, sla_resolve_by
        ) VALUES ($1, 'harassment', 'private_complainant', 'User Content Report', $2, $3, $4, $5, 'open', $6)
        RETURNING id`,
        [
          reporter_user_id || null,
          reason || 'Flagged content report',
          content_type,
          content_id,
          source_surface || 'feed',
          slaResolveBy,
        ]
      );

      callback(null, {
        ticket_id: String(rows[0].id),
      });
    } catch (err) {
      console.error('[gRPC SocialActions.reportContent Error]', err);
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  },
};

module.exports = socialActionsHandlers;
