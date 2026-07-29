/**
 * SocialActions gRPC handler implementations for cpa-manage-backend.
 * Handles inter-service requests from cpa-main-backend to Social DB.
 */
const grpc = require('@grpc/grpc-js');
const { query } = require('../../config/db');

function formatTicket(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    user_id: row.user_id ? String(row.user_id) : '',
    type: row.type || '',
    category: row.category || '',
    description: row.description || '',
    content_type: row.content_type || '',
    content_id: row.content_id ? String(row.content_id) : '',
    source_surface: row.source_surface || '',
    status: row.status || '',
    sla_resolve_by: row.sla_resolve_by ? new Date(row.sla_resolve_by).toISOString() : '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

function formatAction(row) {
  return {
    id: String(row.id),
    ticket_id: String(row.ticket_id),
    action_type: row.action_type || '',
    reason: row.reason || '',
    issued_strike: !!row.issued_strike,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

function formatAppeal(row) {
  return {
    id: String(row.id),
    ticket_id: String(row.ticket_id),
    user_id: String(row.user_id),
    reason: row.reason || '',
    status: row.status || '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

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

  async getMyReports(call, callback) {
    try {
      const { user_id } = call.request || {};
      if (!user_id) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'user_id is required',
        });
      }

      const { rows } = await query(
        `SELECT * FROM support_tickets WHERE user_id::text = $1 ORDER BY created_at DESC`,
        [user_id]
      );

      const tickets = rows.map(formatTicket);
      callback(null, { tickets });
    } catch (err) {
      console.error('[gRPC SocialActions.getMyReports Error]', err);
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  },

  async getCaseDetails(call, callback) {
    try {
      const { ticket_id, user_id } = call.request || {};
      if (!ticket_id) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'ticket_id is required',
        });
      }

      const { rows } = await query(
        `SELECT * FROM support_tickets WHERE id::text = $1`,
        [ticket_id]
      );

      if (rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Case/Ticket not found',
        });
      }

      const ticket = rows[0];
      if (user_id && ticket.user_id && String(ticket.user_id) !== String(user_id)) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Case/Ticket not found',
        });
      }

      const { rows: actionRows } = await query(
        `SELECT * FROM ticket_actions WHERE ticket_id::text = $1 ORDER BY created_at ASC`,
        [ticket_id]
      );

      const { rows: appealRows } = await query(
        `SELECT * FROM appeals WHERE ticket_id::text = $1 ORDER BY created_at DESC`,
        [ticket_id]
      );

      callback(null, {
        ticket: formatTicket(ticket),
        actions: actionRows.map(formatAction),
        appeals: appealRows.map(formatAppeal),
      });
    } catch (err) {
      console.error('[gRPC SocialActions.getCaseDetails Error]', err);
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  },

  async fileAppeal(call, callback) {
    try {
      const { ticket_id, user_id, reason, evidence_urls } = call.request || {};
      if (!ticket_id || !user_id || !reason) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'ticket_id, user_id, and reason are required',
        });
      }

      const ticketRes = await query(`SELECT * FROM support_tickets WHERE id::text = $1`, [ticket_id]);
      if (ticketRes.rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Ticket not found',
        });
      }

      // Check if appeal already exists for this ticket and user
      const existingAppeal = await query(
        `SELECT * FROM appeals WHERE ticket_id::text = $1 AND user_id::text = $2`,
        [ticket_id, user_id]
      );

      if (existingAppeal.rows.length > 0) {
        return callback(null, {
          appeal_id: String(existingAppeal.rows[0].id),
          status: existingAppeal.rows[0].status,
        });
      }

      const { rows } = await query(
        `INSERT INTO appeals (ticket_id, user_id, reason, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id, status`,
        [ticket_id, user_id, reason]
      );

      callback(null, {
        appeal_id: String(rows[0].id),
        status: rows[0].status,
      });
    } catch (err) {
      console.error('[gRPC SocialActions.fileAppeal Error]', err);
      if (err.code === '23505') {
        return callback({
          code: grpc.status.ALREADY_EXISTS,
          message: 'An appeal has already been filed for this ticket.',
        });
      }
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  },

  async createInstitutionClaim(call, callback) {
    try {
      const {
        institution_id,
        claimant_user_id,
        claimant_role,
        official_email,
        proof_documents,
      } = call.request || {};

      if (!institution_id || !claimant_user_id || !official_email) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'institution_id, claimant_user_id, and official_email are required',
        });
      }

      const { rows } = await query(
        `INSERT INTO institution_claims (
          institution_id, claimant_user_id, claimant_role, official_email, proof_documents, status
        ) VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING id, status`,
        [
          institution_id,
          claimant_user_id,
          claimant_role || null,
          official_email,
          proof_documents || [],
        ]
      );

      callback(null, {
        claim_id: String(rows[0].id),
        status: rows[0].status,
      });
    } catch (err) {
      console.error('[gRPC SocialActions.createInstitutionClaim Error]', err);
      if (err.code === '23505') {
        return callback({
          code: grpc.status.ALREADY_EXISTS,
          message: 'A pending or approved claim already exists for this institution.',
        });
      }
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  },
};

module.exports = socialActionsHandlers;
