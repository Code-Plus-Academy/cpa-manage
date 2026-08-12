/**
 * Public webhook endpoints for service-to-service ticket ingestion and Resend Inbound Emails.
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const config = require('../config');
const { Webhook } = require('svix');
const { enqueueInboundEmailJob } = require('../services/inboundEmailQueue');

function requireServiceKey(req, res, next) {
  const key = req.headers['x-service-key'];
  const expected = config.MANAGE_SERVICE_KEY || config.WEBHOOK_SERVICE_KEY;
  // If a service key is configured, strictly validate it
  if (expected && expected.trim() !== '') {
    if (!key || key !== expected) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid or missing service key.' } });
    }
  }
  next();
}

function parseUuid(val) {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
}

// POST /webhook/ingest-ticket — accepts ticket data from CPA main backend
router.post('/ingest-ticket', requireServiceKey, async (req, res) => {
  try {
    const {
      user_id,
      reporter_email,
      type,
      category,
      description,
      evidence_urls = [],
      content_type,
      content_id,
      source_surface,
    } = req.body;

    if (!type || !category || !description) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'type, category and description are required.' } });
    }

    const now = new Date();
    const slaResolveBy = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const safeUserId = parseUuid(user_id);
    const safeContentId = content_id ? String(content_id).trim() : null;

    const { rows } = await query(
      `INSERT INTO support_tickets (
        user_id, reporter_email, type, case_source, category, description,
        evidence_urls, content_type, content_id, source_surface, status, sla_resolve_by
      ) VALUES ($1, $2, $3, 'private_complainant', $4, $5, $6, $7, $8, $9, 'open', $10)
      RETURNING id, sla_resolve_by`,
      [
        safeUserId,
        reporter_email || null,
        type,
        category,
        description,
        Array.isArray(evidence_urls) ? evidence_urls : [],
        content_type || null,
        safeContentId,
        source_surface || null,
        slaResolveBy,
      ]
    );

    const ticket = rows[0];
    res.status(201).json({
      ticket_id: String(ticket.id),
      sla_resolve_by: new Date(ticket.sla_resolve_by).toISOString(),
    });
  } catch (err) {
    console.error('[Webhook ingest-ticket error]', err.message);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Failed to ingest ticket.' } });
  }
});

// POST /webhook/resend-inbound — accepts Resend inbound email webhooks with Svix signature verification
router.post('/resend-inbound', async (req, res) => {
  const secret = config.RESEND_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET;

  // Verify Svix signature if secret is configured
  if (secret && secret.trim() !== '') {
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('[Webhook resend-inbound] Missing Svix headers');
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing Svix signature headers.' } });
    }

    try {
      const wh = new Webhook(secret.trim());
      const payloadString = JSON.stringify(req.body);
      wh.verify(payloadString, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (err) {
      console.error('[Webhook resend-inbound] Svix signature verification failed:', err.message);
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid webhook signature.' } });
    }
  }

  const payload = req.body || {};
  const resendEmailId = payload.data?.email_id || payload.data?.id || payload.email_id || payload.id;

  if (!resendEmailId) {
    // Return 200 OK for ping/challenge webhooks
    return res.status(200).json({ status: 'ok', message: 'Ping acknowledged.' });
  }

  // Enqueue job asynchronously and return 200 OK instantly (<50ms)
  try {
    enqueueInboundEmailJob({
      resendEmailId,
      rawPayload: payload.data || payload,
    }).catch(err => {
      console.error('[Webhook resend-inbound] Async job enqueue error:', err.message);
    });

    return res.status(200).json({
      status: 'queued',
      resend_email_id: resendEmailId,
      received_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Webhook resend-inbound error]', err.message);
    return res.status(200).json({ status: 'error_handled', message: err.message });
  }
});

module.exports = router;
