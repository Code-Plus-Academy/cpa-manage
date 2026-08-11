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
const config = require('../config');

function resolveTicketTarget(ticket) {
  let type = ticket?.content_type || '';
  let id = ticket?.content_id ? String(ticket.content_id) : '';

  if (type && id) return { content_type: type, content_id: id };

  const textToScan = [ticket?.description, ticket?.category, ...(Array.isArray(ticket?.evidence_urls) ? ticket.evidence_urls : [])].filter(Boolean).join(' ');

  const postMatch = textToScan.match(/\/(?:posts|post)\/([a-zA-Z0-9_-]+)/i);
  if (postMatch) return { content_type: 'post', content_id: postMatch[1] };

  const noteMatch = textToScan.match(/\/(?:notes|note|resources|resource)\/([a-zA-Z0-9_-]+)/i);
  if (noteMatch) return { content_type: 'note', content_id: noteMatch[1] };

  const videoMatch = textToScan.match(/\/(?:videos|video|shorts|short)\/([a-zA-Z0-9_-]+)/i);
  if (videoMatch) return { content_type: 'video', content_id: videoMatch[1] };

  const articleMatch = textToScan.match(/\/(?:articles|article)\/([a-zA-Z0-9_-]+)/i);
  if (articleMatch) return { content_type: 'article', content_id: articleMatch[1] };

  const courseMatch = textToScan.match(/\/(?:courses|course)\/([a-zA-Z0-9_-]+)/i);
  if (courseMatch) return { content_type: 'course', content_id: courseMatch[1] };

  const uuidMatch = textToScan.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (uuidMatch) return { content_type: type || 'note', content_id: uuidMatch[0] };

  return { content_type: type, content_id: id };
}

// Helper to determine allowed ticket types based on admin permissions
function getAllowedTicketTypes(adminUser) {
  if (adminUser.is_root) return null; // Null means all types allowed

  const allowedTypes = [];
  const perms = adminUser.permissions || [];

  if (perms.some(p => p.startsWith('support.'))) {
    allowedTypes.push(
      'general-support', 'general', 'support', 'harassment', 'privacy-access',
      'privacy-correction', 'privacy-erasure', 'bug', 'feedback', 'abuse',
      'spam', 'other', 'inquiry', 'account', 'content'
    );
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
      const target = resolveTicketTarget(ticket);
      if (target.content_id && target.content_type) {
        try {
          contentSummary = await contentActionsClient.getContentSummary({
            content_type: target.content_type,
            content_id: String(target.content_id),
          });
          if (contentSummary) {
            if (contentSummary.owner_email) {
              ticket.publisher_email = contentSummary.owner_email;
            }
            if (contentSummary.owner_username) {
              ticket.publisher_name = contentSummary.owner_username;
            }
          }
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
      } else if (['remove_content', 'temporary_takedown'].includes(action_type)) {
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
      else if (action_type === 'temporary_takedown') newStatus = 'temporary_takedown';
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

      // Direct DB update + gRPC/HTTP fallback if content removal approved
      const target = resolveTicketTarget(ticket);
      if (['remove_content', 'approve_claim', 'temporary_takedown'].includes(action_type) && target.content_id && target.content_type) {
        const newStatusPayload = 'removed';
        const cid = String(target.content_id).trim();

        // 1. Direct Database Update (instant execution on shared DB tables)
        try {
          const cType = (target.content_type || '').toLowerCase();
          let targetQuery = null;
          if (cType.includes('post')) {
            targetQuery = `UPDATE posts SET moderation_status = 'removed', status = 'removed', updated_at = NOW() WHERE id::text = $1 OR slug = $1`;
          } else if (cType.includes('note') || cType.includes('resource') || cType.includes('document')) {
            targetQuery = `UPDATE notes SET moderation_status = 'removed', status = 'removed', updated_at = NOW() WHERE id::text = $1 OR slug = $1`;
          } else if (cType.includes('article')) {
            targetQuery = `UPDATE articles SET moderation_status = 'removed', status = 'removed', updated_at = NOW() WHERE id::text = $1 OR slug = $1`;
          } else if (cType.includes('video')) {
            targetQuery = `UPDATE feed_videos SET moderation_status = 'removed', status = 'removed', updated_at = NOW() WHERE id::text = $1`;
          }

          if (targetQuery) {
            await query(targetQuery, [cid]).catch(() => {});
            console.info(`[cases.js Direct DB Update] Updated moderation status to 'removed' for ${target.content_type} (${cid})`);
          }
        } catch (dbErr) {
          console.warn('[cases.js Direct DB Update warning]:', dbErr.message);
        }

        // 2. gRPC / HTTP notification to main backend (for Redis cache purging & search index removal)
        let setStatusOk = false;

        try {
          const res = await contentActionsClient.setContentStatus({
            ref: { content_type: target.content_type, content_id: String(target.content_id) },
            new_status: newStatusPayload,
            reason,
            actor_admin_id: req.adminUser.id,
          });
          if (res && res.success) {
            setStatusOk = true;
          }
        } catch (grpcErr) {
          console.warn('[gRPC SetContentStatus call failed]:', grpcErr.message, '— attempting HTTP fallback...');
        }

        if (!setStatusOk) {
          try {
            const mainBackendUrl = process.env.MAIN_BACKEND_URL || config.MAIN_BACKEND_URL || 'https://api.codeplusacademy.in';
            if (mainBackendUrl) {
              const serviceKey = process.env.MANAGE_SERVICE_KEY || process.env.INTERNAL_SERVICE_KEY || process.env.CALLBACK_TOKEN || '';
              const fetchFn = typeof fetch !== 'undefined' ? fetch : globalThis.fetch;
              const resp = await fetchFn(`${mainBackendUrl.replace(/\/$/, '')}/api/internal/set-content-status`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': serviceKey ? `Bearer ${serviceKey}` : '',
                },
                body: JSON.stringify({
                  content_type: target.content_type,
                  content_id: String(target.content_id),
                  new_status: newStatusPayload,
                  reason,
                  actor_admin_id: req.adminUser.id,
                }),
              });
              if (!resp.ok) {
                const errText = await resp.text();
                console.error('[HTTP SetContentStatus] Failed with HTTP status:', resp.status, errText);
              } else {
                console.info('[HTTP SetContentStatus] Successfully updated content status on main backend via HTTP');
              }
            }
          } catch (httpErr) {
            console.error('[HTTP SetContentStatus Failed]:', httpErr.message);
          }
        }
      }

      // Dispatch Automated Email Notifications (Publisher & Reporter)
      try {
        const { enqueueTemplatedEmail } = require('../services/emailQueue');

        // Select appropriate template based on action_type
        let selectedTemplateKey = 'moderation_action_notice';
        if (action_type === 'temporary_takedown') {
          selectedTemplateKey = 'temporary_takedown_7day';
        } else if (action_type === 'remove_content') {
          selectedTemplateKey = 'permanent_takedown_notice';
        } else if (action_type === 'approve_claim' || action_type.toLowerCase().includes('copyright')) {
          selectedTemplateKey = 'copyright_infringement_notice';
        }

        // Generate content_url for inspection
        let contentUrl = '';
        if (ticket.content_id) {
          const typeStr = (ticket.content_type || 'posts').toLowerCase().trim();
          let pathCat = 'posts';
          if (typeStr.includes('course')) pathCat = 'courses';
          else if (typeStr.includes('video')) pathCat = 'videos';
          else if (typeStr.includes('article')) pathCat = 'articles';
          else if (typeStr.includes('short')) pathCat = 'shorts';
          else if (typeStr.includes('note')) pathCat = 'notes';
          else pathCat = typeStr.endsWith('s') ? typeStr : `${typeStr}s`;
          contentUrl = `https://www.codeplusacademy.in/${pathCat}/${ticket.content_id}`;
        }

        // Fetch contentSummary if content details are attached
        let contentSummary = null;
        if (target.content_id && target.content_type) {
          try {
            contentSummary = await contentActionsClient.getContentSummary({
              content_type: target.content_type,
              content_id: String(target.content_id),
            });
          } catch (csErr) {
            console.warn('[gRPC GetContentSummary in action notice warning]:', csErr.message);
          }
        }

        let fallbackTitle = ticket.category || 'Content Item';
        let fallbackOwnerEmail = ticket.publisher_email || (contentSummary && contentSummary.owner_email) || null;
        let fallbackOwnerName = ticket.publisher_name || (contentSummary && contentSummary.owner_username) || 'Creator / Publisher';

        const cid = target.content_id ? String(target.content_id).trim() : '';
        const cType = (target.content_type || '').toLowerCase();

        // 1. Specific DB query based on content_type
        if (!fallbackOwnerEmail && cid && cType) {
          try {
            let dbQuery = null;
            if (cType.includes('post')) {
              dbQuery = `SELECT p.caption AS title, u.email AS owner_email, COALESCE(u.display_name, u.full_name) AS owner_name
                         FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id::text = $1 OR p.slug = $1`;
            } else if (cType.includes('note') || cType.includes('resource') || cType.includes('document')) {
              dbQuery = `SELECT n.title, u.email AS owner_email, COALESCE(u.display_name, u.full_name) AS owner_name
                         FROM notes n JOIN users u ON n.user_id = u.id WHERE n.id::text = $1 OR n.slug = $1`;
            } else if (cType.includes('article')) {
              dbQuery = `SELECT a.title, u.email AS owner_email, COALESCE(u.display_name, u.full_name) AS owner_name
                         FROM articles a JOIN users u ON (a.author_id = u.id OR a.user_id = u.id) WHERE a.id::text = $1 OR a.slug = $1`;
            } else if (cType.includes('video') || cType.includes('short')) {
              dbQuery = `SELECT v.title, u.email AS owner_email, COALESCE(u.display_name, u.full_name) AS owner_name
                         FROM feed_videos v JOIN users u ON v.user_id = u.id WHERE v.id::text = $1`;
            }

            if (dbQuery) {
              const { rows: dbRows } = await query(dbQuery, [cid]).catch(() => ({ rows: [] }));
              if (dbRows.length > 0) {
                if (dbRows[0].owner_email) fallbackOwnerEmail = dbRows[0].owner_email;
                if (dbRows[0].owner_name) fallbackOwnerName = dbRows[0].owner_name;
                if (dbRows[0].title) fallbackTitle = dbRows[0].title;
              }
            }
          } catch (dbErr) {
            console.warn('[Direct DB owner lookup warning]:', dbErr.message);
          }
        }

        // 2. Universal multi-table UNION ALL search across all content tables if still not found
        if (!fallbackOwnerEmail && cid) {
          try {
            const { rows: uRows } = await query(`
              SELECT u.email AS owner_email, COALESCE(u.display_name, u.full_name) AS owner_name, n.title
              FROM notes n JOIN users u ON n.user_id = u.id WHERE n.id::text = $1 OR n.slug = $1
              UNION ALL
              SELECT u.email AS owner_email, COALESCE(u.display_name, u.full_name) AS owner_name, p.caption AS title
              FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id::text = $1 OR p.slug = $1
              UNION ALL
              SELECT u.email AS owner_email, COALESCE(u.display_name, u.full_name) AS owner_name, v.title
              FROM feed_videos v JOIN users u ON v.user_id = u.id WHERE v.id::text = $1
              UNION ALL
              SELECT u.email AS owner_email, COALESCE(u.display_name, u.full_name) AS owner_name, a.title
              FROM articles a JOIN users u ON (a.author_id = u.id OR a.user_id = u.id) WHERE a.id::text = $1 OR a.slug = $1
              LIMIT 1
            `, [cid]).catch(() => ({ rows: [] }));

            if (uRows.length > 0) {
              if (uRows[0].owner_email) fallbackOwnerEmail = uRows[0].owner_email;
              if (uRows[0].owner_name) fallbackOwnerName = uRows[0].owner_name;
              if (uRows[0].title) fallbackTitle = uRows[0].title;
            }
          } catch (uDbErr) {
            console.warn('[Universal DB owner lookup warning]:', uDbErr.message);
          }
        }

        // 3. Direct DB user_id fallback
        if (!fallbackOwnerEmail && ticket.user_id) {
          try {
            const { rows: uRows } = await query(`SELECT email, COALESCE(display_name, full_name) AS owner_name FROM users WHERE id::text = $1`, [ticket.user_id]);
            if (uRows.length > 0) {
              fallbackOwnerEmail = uRows[0].email;
              if (uRows[0].owner_name) fallbackOwnerName = uRows[0].owner_name;
            }
          } catch (uErr) {
            console.warn('[Direct DB user_id lookup warning]:', uErr.message);
          }
        }

        const publisherEmail = fallbackOwnerEmail;
        const publisherName = fallbackOwnerName;
        const finalContentTitle = (contentSummary && contentSummary.title) || fallbackTitle;

        if (publisherEmail) {
          enqueueTemplatedEmail({
            templateKey: selectedTemplateKey,
            recipientEmail: publisherEmail,
            payload: {
              name: publisherName,
              ticket_id: String(ticket.id),
              action_type,
              reason,
              content_title: finalContentTitle,
              content_url: contentUrl,
            },
            userId: (contentSummary && contentSummary.owner_id) || null,
          }).then(() => {
            console.info(`[cases.js] Automated ${selectedTemplateKey} email enqueued for publisher: ${publisherEmail}`);
          }).catch(err => console.warn('[cases.js] Automated notice to publisher failed:', err.message));
        } else {
          console.warn(`[cases.js Notice Warning] Could not resolve publisher email for ticket #${ticket.id} (content_id: ${target.content_id}, user_id: ${ticket.user_id}). Email notice skipped.`);
        }

        // 2. Send Ticket Update Notice to Complainant / Reporter (if different from publisher)
        if (ticket.reporter_email && ticket.reporter_email !== publisherEmail) {
          enqueueTemplatedEmail({
            templateKey: 'moderation_action_notice',
            recipientEmail: ticket.reporter_email,
            payload: {
              name: 'Complainant',
              ticket_id: String(ticket.id),
              action_type,
              reason,
              content_title: (contentSummary && contentSummary.title) || ticket.category || 'Reported Item',
              content_url: contentUrl,
            },
            userId: ticket.user_id || null,
          }).catch(err => console.warn('[cases.js] Update notice to reporter failed:', err.message));
        }
      } catch (emailErr) {
        console.warn('[Publisher/Reporter Notification Email Failed]:', emailErr.message);
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

const aiService = require('../services/aiService');

// POST /admin/cases/refine-justification — Refine raw admin notes into formal compliance statement via AI
router.post('/refine-justification', async (req, res, next) => {
  try {
    const { raw_notes, case_type } = req.body;
    if (!raw_notes || !raw_notes.trim()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Raw justification text is required' } });
    }

    const refined = await aiService.refineJustification({
      raw_notes,
      case_type: case_type || 'moderation',
    });

    res.json({ refined_justification: refined, original: raw_notes });
  } catch (err) {
    next(err);
  }
});

// POST /admin/cases/:id/send-email — Send direct email to publisher/reporter via platform email system
router.post(
  '/:id/send-email',
  requirePermission.any(['support.respond', 'email.campaign.send']),
  async (req, res, next) => {
    const client = await getClient();
    try {
      const { id } = req.params;
      const { recipient_email, template_key, payload = {}, subject, message } = req.body;

      if (!recipient_email) {
        return next(new AppError('VALIDATION_ERROR', 400, { fields: { recipient_email: 'required' } }));
      }

      const { rows } = await query('SELECT * FROM support_tickets WHERE id::text = $1', [id]);
      if (rows.length === 0) {
        return next(new AppError('NOT_FOUND', 404));
      }
      const ticket = rows[0];

      let sentOk = false;
      let actionReason = '';

      if (template_key) {
        // Option A: Send via Email Management System (Templates & Queue Engine)
        const { enqueueTemplatedEmail } = require('../services/emailQueue');
        const defaultPayload = {
          name: payload.name || ticket.publisher_name || 'Creator / User',
          ticket_id: String(ticket.id),
          action_type: payload.action_type || ticket.status || 'notice',
          reason: payload.reason || message || 'Administrative Notice',
          content_title: payload.content_title || ticket.category || 'Content Item',
          ...payload,
        };

        const job = await enqueueTemplatedEmail({
          templateKey: template_key,
          recipientEmail: recipient_email,
          payload: defaultPayload,
          userId: ticket.user_id || null,
        });

        sentOk = !!job;
        actionReason = `Templated Email (${template_key}) sent to ${recipient_email}`;
      } else {
        // Option B: Ad-hoc Custom Email Dispatch
        if (!subject || !message) {
          return next(new AppError('VALIDATION_ERROR', 400, {
            fields: {
              subject: !subject ? 'required' : undefined,
              message: !message ? 'required' : undefined,
            }
          }));
        }

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;">
            <h2 style="color: #4f46e5; margin-top: 0; font-size: 20px;">Code+ Academy Trust & Safety Notice</h2>
            <p>Regarding Case / Ticket <strong>#${ticket.id}</strong> (${ticket.category || 'General Inquiry'}):</p>
            <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #4f46e5; margin: 16px 0; border-radius: 6px; white-space: pre-wrap; font-size: 14px; color: #334155;">${message}</div>
            <p style="font-size: 12px; color: #64748b; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px;">This is an official administrative email dispatched from Code+ Academy Administration.</p>
            <p style="font-size: 13px; color: #334155; margin-bottom: 0;">Best regards,<br/><strong>Code+ Academy Support & Compliance Team</strong></p>
          </div>
        `;

        const { sendMail } = require('../services/emailService');
        sentOk = await sendMail({
          to: recipient_email,
          subject,
          html: htmlBody,
        });
        actionReason = `Direct Custom Email to ${recipient_email}: "${subject}"`;
      }

      if (!sentOk) {
        return next(new AppError('INTERNAL_ERROR', 500, null, 'Failed to send email via platform email system.'));
      }

      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ticket_actions (ticket_id, admin_id, action_type, reason, issued_strike)
         VALUES ($1, $2, 'direct_email_sent', $3, false)`,
        [ticket.id, req.adminUser.id, actionReason]
      );

      await writeAuditLog(client, {
        actorAdminId: req.adminUser.id,
        actorIsRoot: req.adminUser.is_root,
        permissionUsed: 'support.respond',
        module: 'support',
        action: 'cases.send_direct_email',
        targetType: 'ticket',
        targetId: String(ticket.id),
        reason: `Sent direct email to ${recipient_email}`,
        metadata: { recipient: recipient_email, subject },
      });

      await client.query('COMMIT');

      res.json({ success: true, message: `Email dispatched successfully to ${recipient_email}` });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
