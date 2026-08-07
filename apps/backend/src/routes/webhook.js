/**
 * Public webhook endpoints for service-to-service ticket ingestion.
 * Authenticated via X-Service-Key header (shared secret).
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const config = require('../config');

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

module.exports = router;
