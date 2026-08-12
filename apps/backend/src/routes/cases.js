/**
 * Admin Support Cases & Tickets Router — cpa-manage-backend.
 * Enforces row-level permission filtering and same-transaction audit logging.
 */
const express = require('express');
const router = express.Router();
const { query, getClient, contentQuery } = require('../config/db');
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
      'spam', 'other', 'inquiry', 'account', 'content', 'email_inbound', 'content-report', 'email', 'report'
    );
  }
  if (perms.some(p => p.startsWith('claims.copyright.'))) {
    allowedTypes.push('copyright', 'content-report');
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
        if (type === 'email' || type === 'emails' || type === 'email_inbound') {
          conditions.push(`(type = 'email_inbound' OR type = 'email' OR target_mailbox IS NOT NULL)`);
        } else if (type === 'report' || type === 'reports' || type === 'content-report') {
          conditions.push(`(type = 'content-report' OR type = 'report' OR category = 'user_report')`);
        } else {
          conditions.push(`type = $${idx++}`);
          values.push(type);
        }
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

      await client.query('BEGIN');

      const { rows } = await client.query('SELECT * FROM support_tickets WHERE id::text = $1 FOR UPDATE', [id]);
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return next(new AppError('NOT_FOUND', 404));
      }

      const ticket = rows[0];

      // Terminal status guard (Bug #11)
      if (['closed', 'dismissed', 'action_taken'].includes(ticket.status)) {
        await client.query('ROLLBACK');
        return next(new AppError('BAD_REQUEST', 400, { message: `Ticket is already in terminal status '${ticket.status}'. No further actions allowed.` }));
      }

      // Strict Permission mapping check (Bug #2)
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
      } else {
        // Unmapped action_type → Default to strict admin restriction (Bug #2 fix)
        requiredPerm = 'support.respond';
      }

      if (!req.adminUser.is_root && !req.adminUser.permissions.includes(requiredPerm)) {
        await client.query('ROLLBACK');
        return next(new AppError('PERMISSION_DENIED', 403, { required: requiredPerm }));
      }

      if (issue_strike && !req.adminUser.is_root && !req.adminUser.permissions.includes('users.strike')) {
        await client.query('ROLLBACK');
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
            targetQuery = `UPDATE resources SET moderation_status = 'removed', status = 'removed', updated_at = NOW() WHERE id::text = $1 OR slug = $1`;
          } else if (cType.includes('article')) {
            targetQuery = `UPDATE articles SET moderation_status = 'removed', status = 'removed', updated_at = NOW() WHERE id::text = $1 OR slug = $1`;
          } else if (cType.includes('video') || cType.includes('short')) {
            targetQuery = `UPDATE feed_videos SET moderation_status = 'removed', status = 'removed', updated_at = NOW() WHERE id::text = $1`;
          } else if (cType.includes('course')) {
            targetQuery = `UPDATE courses SET moderation_status = 'removed', status = 'removed', updated_at = NOW() WHERE id::text = $1 OR slug = $1`;
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
            console.warn('[gRPC GetContentSummary in action notice warning]:', csErr.message, '— attempting HTTP fallback...');
          }

          // HTTP REST API Fallback to Main Backend if gRPC is down
          if (!contentSummary) {
            try {
              const mainBackendUrl = process.env.MAIN_BACKEND_URL || config.MAIN_BACKEND_URL || 'https://api.codeplusacademy.in';
              const serviceKey = process.env.MANAGE_SERVICE_KEY || process.env.INTERNAL_SERVICE_KEY || process.env.CALLBACK_TOKEN || '';
              const resp = await fetch(`${mainBackendUrl}/api/internal/content-summary`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': serviceKey ? `Bearer ${serviceKey}` : '',
                },
                body: JSON.stringify({ content_type: target.content_type, content_id: String(target.content_id) }),
                signal: AbortSignal.timeout(5000),
              }).catch(() => null);

              if (resp && resp.ok) {
                const data = await resp.json().catch(() => null);
                if (data && (data.owner_email || data.title)) {
                  contentSummary = data;
                  console.info('[HTTP GetContentSummary] Resolved content summary via HTTP fallback for:', target.content_id);
                }
              }
            } catch (httpErr) {
              console.warn('[HTTP GetContentSummary fallback warning]:', httpErr.message);
            }
          }
        }

        let fallbackTitle = ticket.category || 'Content Item';
        let fallbackOwnerEmail = ticket.publisher_email || (contentSummary && contentSummary.owner_email) || null;
        let fallbackOwnerName = ticket.publisher_name || (contentSummary && contentSummary.owner_username) || 'Creator / Publisher';

        const cid = target.content_id ? String(target.content_id).trim() : '';
        const cType = (target.content_type || '').toLowerCase();

        // 1. Social DB lookup (posts, resources live here)
        if (!fallbackOwnerEmail && cid && cType) {
          try {
            let dbSql = null;
            if (cType.includes('post')) {
              dbSql = `SELECT p.title, u.email AS owner_email, COALESCE(u.name, u.username) AS owner_name
                       FROM posts p JOIN users u ON p.creator_id::text = u.id::text WHERE p.id::text = $1 OR p.slug = $1`;
            } else if (cType.includes('note') || cType.includes('resource') || cType.includes('document')) {
              dbSql = `SELECT r.title, u.email AS owner_email, COALESCE(u.name, u.username) AS owner_name
                       FROM resources r JOIN users u ON r.creator_id::text = u.id::text WHERE r.id::text = $1 OR r.slug = $1`;
            }
            if (dbSql) {
              const { rows: dbRows } = await query(dbSql, [cid]).catch(() => ({ rows: [] }));
              if (dbRows.length > 0) {
                if (dbRows[0].owner_email) fallbackOwnerEmail = dbRows[0].owner_email;
                if (dbRows[0].owner_name) fallbackOwnerName = dbRows[0].owner_name;
                if (dbRows[0].title) fallbackTitle = dbRows[0].title;
              }
            }
          } catch (dbErr) {
            console.warn('[Social DB owner lookup warning]:', dbErr.message);
          }
        }

        // 2. Content DB lookup (feed_videos, articles live here)
        if (!fallbackOwnerEmail && cid && cType) {
          try {
            let contentSql = null;
            // Content DB has its own users table (Supabase auth.users)
            if (cType.includes('video') || cType.includes('short')) {
              contentSql = `SELECT v.title, u.email AS owner_email
                            FROM feed_videos v JOIN auth.users u ON v.user_id = u.id WHERE v.id::text = $1`;
            } else if (cType.includes('article')) {
              contentSql = `SELECT a.title, u.email AS owner_email
                            FROM articles a JOIN auth.users u ON a.creator_id = u.id WHERE a.id::text = $1 OR a.slug = $1`;
            }
            if (contentSql) {
              const { rows: cRows } = await contentQuery(contentSql, [cid]).catch(() => ({ rows: [] }));
              if (cRows.length > 0) {
                if (cRows[0].owner_email) fallbackOwnerEmail = cRows[0].owner_email;
                if (cRows[0].title) fallbackTitle = cRows[0].title;
                console.info(`[Content DB] Resolved publisher email via Content DB for ${cType}: ${cid}`);
              }
            }
          } catch (cDbErr) {
            console.warn('[Content DB owner lookup warning]:', cDbErr.message);
          }
        }

        // 3. Social DB universal fallback (posts + resources)
        if (!fallbackOwnerEmail && cid) {
          try {
            const { rows: uRows } = await query(`
              SELECT u.email AS owner_email, COALESCE(u.name, u.username) AS owner_name, r.title
              FROM resources r JOIN users u ON r.creator_id::text = u.id::text WHERE r.id::text = $1 OR r.slug = $1
              UNION ALL
              SELECT u.email AS owner_email, COALESCE(u.name, u.username) AS owner_name, p.title
              FROM posts p JOIN users u ON p.creator_id::text = u.id::text WHERE p.id::text = $1 OR p.slug = $1
              LIMIT 1
            `, [cid]).catch(() => ({ rows: [] }));

            if (uRows.length > 0) {
              if (uRows[0].owner_email) fallbackOwnerEmail = uRows[0].owner_email;
              if (uRows[0].owner_name) fallbackOwnerName = uRows[0].owner_name;
              if (uRows[0].title) fallbackTitle = uRows[0].title;
            }
          } catch (uDbErr) {
            console.warn('[Social DB universal lookup warning]:', uDbErr.message);
          }
        }

        // 4. Content DB universal fallback (videos + articles)
        if (!fallbackOwnerEmail && cid) {
          try {
            const { rows: cRows } = await contentQuery(`
              SELECT u.email AS owner_email, v.title
              FROM feed_videos v JOIN auth.users u ON v.user_id = u.id WHERE v.id::text = $1
              UNION ALL
              SELECT u.email AS owner_email, a.title
              FROM articles a JOIN auth.users u ON a.creator_id = u.id WHERE a.id::text = $1 OR a.slug = $1
              LIMIT 1
            `, [cid]).catch(() => ({ rows: [] }));

            if (cRows.length > 0) {
              if (cRows[0].owner_email) fallbackOwnerEmail = cRows[0].owner_email;
              if (cRows[0].title) fallbackTitle = cRows[0].title;
              console.info(`[Content DB] Resolved publisher email via Content DB universal fallback: ${cid}`);
            }
          } catch (cDbErr) {
            console.warn('[Content DB universal lookup warning]:', cDbErr.message);
          }
        }

        // 5. Direct user_id fallback (ONLY for generic support tickets without a content_id, Bug #1 privacy fix)
        if (!fallbackOwnerEmail && !cid && ticket.user_id) {
          try {
            const { rows: uRows } = await query(`SELECT email, COALESCE(name, username) AS owner_name FROM users WHERE id::text = $1`, [ticket.user_id]);
            if (uRows.length > 0) {
              fallbackOwnerEmail = uRows[0].email;
              if (uRows[0].owner_name) fallbackOwnerName = uRows[0].owner_name;
            }
          } catch (uErr) {
            console.warn('[Social DB user_id lookup warning]:', uErr.message);
          }

          if (!fallbackOwnerEmail) {
            try {
              const { rows: cRows } = await contentQuery(`SELECT email FROM auth.users WHERE id::text = $1`, [ticket.user_id]);
              if (cRows.length > 0 && cRows[0].email) {
                fallbackOwnerEmail = cRows[0].email;
                console.info(`[Content DB] Resolved user email via Content DB auth.users: ${ticket.user_id}`);
              }
            } catch (cErr) {
              console.warn('[Content DB user_id lookup warning]:', cErr.message);
            }
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

// ─── GET /admin/cases/:id/messages (Fetch Email Thread & Soft Lock Info) ──────
router.get(
  '/:id/messages',
  requirePermission.any(['support.view', 'claims.copyright.view', 'claims.institution.view', 'claims.reclaim.view']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { rows: ticketRows } = await query(
        `SELECT t.*, a.display_name as viewing_admin_name
         FROM support_tickets t
         LEFT JOIN admin_users a ON t.viewing_admin_id = a.id
         WHERE t.id::text = $1`,
        [id]
      );

      if (ticketRows.length === 0) {
        return next(new AppError('NOT_FOUND', 404, null, 'Ticket not found.'));
      }

      const ticket = ticketRows[0];

      // Soft Lock Expiry Check (5 min TTL)
      const LOCK_TTL_MS = 5 * 60 * 1000;
      let activeLock = null;
      if (ticket.viewing_admin_id && ticket.viewing_admin_since) {
        const lockAge = Date.now() - new Date(ticket.viewing_admin_since).getTime();
        if (lockAge < LOCK_TTL_MS && ticket.viewing_admin_id !== req.adminUser.id) {
          activeLock = {
            admin_id: ticket.viewing_admin_id,
            admin_name: ticket.viewing_admin_name || 'Another Admin',
            since: ticket.viewing_admin_since,
          };
        }
      }

      const { rows: messages } = await query(
        `SELECT m.*, a.display_name as sender_admin_name
         FROM support_email_messages m
         LEFT JOIN admin_users a ON m.sender_admin_id = a.id
         WHERE m.ticket_id = $1
         ORDER BY m.created_at ASC`,
        [ticket.id]
      );

      res.json({
        ticket_id: ticket.id,
        target_mailbox: ticket.target_mailbox || 'support',
        reporter_email: ticket.reporter_email,
        status: ticket.status,
        messages,
        active_lock: activeLock,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /admin/cases/:id/reply (Outbound Admin Reply with Thread Headers) ────
router.post(
  '/:id/reply',
  requirePermission.any(['support.respond', 'claims.copyright.take_action', 'claims.institution.take_action']),
  async (req, res, next) => {
    const client = await getClient();
    try {
      const { id } = req.params;
      const { message_html, message_text, sender_email, status_action = 'keep_open' } = req.body;

      if (!message_html && !message_text) {
        return next(new AppError('VALIDATION_ERROR', 400, null, 'Reply content (HTML or Text) is required.'));
      }

      const { rows: ticketRows } = await query('SELECT * FROM support_tickets WHERE id::text = $1', [id]);
      if (ticketRows.length === 0) {
        return next(new AppError('NOT_FOUND', 404, null, 'Ticket not found.'));
      }

      const ticket = ticketRows[0];
      const recipientEmail = ticket.reporter_email;
      if (!recipientEmail) {
        return next(new AppError('VALIDATION_ERROR', 400, null, 'Ticket has no reporter email address to reply to.'));
      }

      // Fetch message history for threading headers
      const { rows: existingMsgs } = await query(
        `SELECT internet_message_id FROM support_email_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
        [ticket.id]
      );

      const allMessageIds = existingMsgs.map(m => m.internet_message_id).filter(Boolean);
      const latestMessageId = allMessageIds.length > 0 ? allMessageIds[allMessageIds.length - 1] : null;

      // Build In-Reply-To and References headers
      const headers = {};
      if (latestMessageId) {
        headers['In-Reply-To'] = latestMessageId;
        headers['References'] = allMessageIds.join(' ');
      }

      // Determine sender email: provided sender_email -> default sender_emails -> fallback env
      let fromAddress = sender_email;
      if (!fromAddress) {
        const { rows: defaultSenderRows } = await query(
          'SELECT email, display_name FROM sender_emails WHERE is_default = true LIMIT 1'
        );
        if (defaultSenderRows.length > 0) {
          const s = defaultSenderRows[0];
          fromAddress = s.display_name ? `${s.display_name} <${s.email}>` : s.email;
        } else {
          fromAddress = process.env.EMAIL_FROM_ADDRESS || 'support@codeplusacademy.in';
        }
      }

      const subject = `Re: [Ticket #${ticket.id.slice(0, 8)}] ${ticket.category || 'Support Request'}`;
      const replyBodyHtml = message_html || `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">${(message_text || '').replace(/\n/g, '<br/>')}</div>`;
      const replyBodyText = message_text || message_html.replace(/<[^>]+>/g, '');

      const { sendMail } = require('../services/emailService');
      const sendResult = await sendMail({
        to: recipientEmail,
        subject,
        html: replyBodyHtml,
        from: fromAddress,
        headers,
      });

      if (!sendResult || (!sendResult.success && sendResult !== true)) {
        return next(new AppError('INTERNAL_ERROR', 500, null, 'Failed to dispatch outbound reply email via Resend.'));
      }

      const resendResponseId = typeof sendResult === 'object' ? sendResult.messageId : null;
      const outboundMessageId = `<outbound-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@codeplusacademy.in>`;

      await client.query('BEGIN');

      // Insert outbound message history
      const { rows: insertedMsgs } = await client.query(
        `INSERT INTO support_email_messages (
          ticket_id, resend_email_id, internet_message_id, direction,
          from_address, to_address, subject, body_html, body_text, sender_admin_id, resend_response_id
        ) VALUES ($1, $2, $3, 'outbound', $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          ticket.id,
          `outbound_${Date.now()}_${resendResponseId || 'ok'}`,
          outboundMessageId,
          typeof fromAddress === 'string' ? fromAddress : 'support@codeplusacademy.in',
          [recipientEmail],
          subject,
          replyBodyHtml,
          replyBodyText,
          req.adminUser.id,
          resendResponseId,
        ]
      );

      // Update ticket status, last_message_at, references_message_ids, and release lock
      const newStatus = status_action === 'resolve' ? 'resolved' : 'open';
      const updatedRefs = Array.from(new Set([...(ticket.references_message_ids || []), outboundMessageId]));

      await client.query(
        `UPDATE support_tickets
         SET status = $1,
             last_message_at = NOW(),
             references_message_ids = $2,
             viewing_admin_id = NULL,
             viewing_admin_since = NULL,
             updated_at = NOW()
         WHERE id = $3`,
        [newStatus, updatedRefs, ticket.id]
      );

      // Log ticket action
      await client.query(
        `INSERT INTO ticket_actions (ticket_id, admin_id, action_type, reason, issued_strike)
         VALUES ($1, $2, 'email_reply_sent', $3, false)`,
        [ticket.id, req.adminUser.id, `Outbound email reply sent to ${recipientEmail} (${status_action})`]
      );

      await writeAuditLog(client, {
        actorAdminId: req.adminUser.id,
        actorIsRoot: req.adminUser.is_root,
        permissionUsed: 'support.respond',
        module: 'support',
        action: 'cases.send_email_reply',
        targetType: 'ticket',
        targetId: String(ticket.id),
        reason: `Sent outbound email reply to ${recipientEmail}`,
        metadata: { status_action, resend_response_id: resendResponseId },
      });

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Reply sent successfully to ${recipientEmail}`,
        email_message: insertedMsgs[0],
        ticket_status: newStatus,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// ─── POST /admin/cases/:id/lock (Set Admin Soft Lock) ─────────────────────────
router.post(
  '/:id/lock',
  requirePermission.any(['support.view', 'claims.copyright.view', 'claims.institution.view', 'claims.reclaim.view']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const { rows } = await query(
        `UPDATE support_tickets
         SET viewing_admin_id = $1,
             viewing_admin_since = NOW()
         WHERE id::text = $2
         RETURNING id, viewing_admin_id, viewing_admin_since`,
        [req.adminUser.id, id]
      );

      if (rows.length === 0) {
        return next(new AppError('NOT_FOUND', 404, null, 'Ticket not found.'));
      }

      res.json({ success: true, lock: rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /admin/cases/:id/lock (Release Admin Soft Lock) ───────────────────
router.delete(
  '/:id/lock',
  requirePermission.any(['support.view', 'claims.copyright.view', 'claims.institution.view', 'claims.reclaim.view']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await query(
        `UPDATE support_tickets
         SET viewing_admin_id = NULL,
             viewing_admin_since = NULL
         WHERE id::text = $1 AND (viewing_admin_id = $2 OR viewing_admin_id IS NULL)`,
        [id, req.adminUser.id]
      );

      res.json({ success: true, message: 'Lock released.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
