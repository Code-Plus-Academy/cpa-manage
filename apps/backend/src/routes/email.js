/**
 * Admin Email System Router — cpa-manage-backend.
 * Handles email templates, schedules, campaigns, and send analytics
 * with permission guards and same-transaction audit logging.
 */
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/db');
const { AppError } = require('../utils/errors');
const requirePermission = require('../middleware/requirePermission');
const { writeAuditLog } = require('../middleware/auditLog');

// ─── TEMPLATES ─────────────────────────────────────────────────────────────────

// GET /admin/email/templates
router.get('/templates', requirePermission.any(['email.templates.edit', 'email.analytics.view']), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM email_templates ORDER BY created_at DESC');
    res.json({ templates: rows });
  } catch (err) {
    next(err);
  }
});

// GET /admin/email/templates/:key
router.get('/templates/:key', requirePermission.any(['email.templates.edit', 'email.analytics.view']), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { rows } = await query('SELECT * FROM email_templates WHERE key = $1', [key]);
    if (rows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Email template not found.'));
    }
    res.json({ template: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /admin/email/templates
router.post('/templates', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { key, name, category, subject_template, body_html_template, is_active = true } = req.body;

    if (!key || !name || !category || !subject_template || !body_html_template) {
      return next(new AppError('VALIDATION_ERROR', 400, {
        fields: {
          key: !key ? 'required' : undefined,
          name: !name ? 'required' : undefined,
          category: !category ? 'required' : undefined,
          subject_template: !subject_template ? 'required' : undefined,
          body_html_template: !body_html_template ? 'required' : undefined,
        }
      }));
    }

    if (!['transactional', 'security', 'promotional'].includes(category)) {
      return next(new AppError('VALIDATION_ERROR', 400, null, 'Category must be transactional, security, or promotional.'));
    }

    const { rows: existing } = await query('SELECT id FROM email_templates WHERE key = $1', [key.trim()]);
    if (existing.length > 0) {
      return next(new AppError('CONFLICT', 409, null, 'An email template with this key already exists.'));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO email_templates (key, name, category, subject_template, body_html_template, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [key.trim(), name.trim(), category, subject_template, body_html_template, is_active, req.adminUser.id]
    );

    const newTemplate = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.templates.edit',
      module: 'email',
      action: 'email.template_create',
      targetType: 'email_template',
      targetId: newTemplate.key,
      reason: `Created email template ${newTemplate.key}`,
    });

    await client.query('COMMIT');

    res.status(201).json({ template: newTemplate });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /admin/email/templates/:key
router.patch('/templates/:key', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { key } = req.params;
    const { name, category, subject_template, body_html_template, is_active } = req.body;

    const { rows: existing } = await query('SELECT * FROM email_templates WHERE key = $1', [key]);
    if (existing.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Email template not found.'));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE email_templates
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           subject_template = COALESCE($3, subject_template),
           body_html_template = COALESCE($4, body_html_template),
           is_active = COALESCE($5, is_active),
           version = version + 1
       WHERE key = $6
       RETURNING *`,
      [name, category, subject_template, body_html_template, is_active, key]
    );

    const updatedTemplate = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.templates.edit',
      module: 'email',
      action: 'email.template_update',
      targetType: 'email_template',
      targetId: key,
      reason: `Updated email template ${key}`,
    });

    await client.query('COMMIT');

    res.json({ template: updatedTemplate });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── SCHEDULES ─────────────────────────────────────────────────────────────────

// GET /admin/email/schedules
router.get('/schedules', requirePermission.any(['email.schedule.manage', 'email.analytics.view']), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, t.name as template_name
       FROM email_schedules s
       LEFT JOIN email_templates t ON t.key = s.template_key
       ORDER BY s.updated_at DESC`
    );
    res.json({ schedules: rows });
  } catch (err) {
    next(err);
  }
});

// POST /admin/email/schedules
router.post('/schedules', requirePermission('email.schedule.manage'), async (req, res, next) => {
  const client = await getClient();
  try {
    const {
      template_key, trigger_type, frequency_kind,
      interval_value, interval_unit, cron_expression,
      randomize_window_minutes = 0, is_active = true
    } = req.body;

    if (!template_key || !trigger_type || !frequency_kind) {
      return next(new AppError('VALIDATION_ERROR', 400, {
        fields: {
          template_key: !template_key ? 'required' : undefined,
          trigger_type: !trigger_type ? 'required' : undefined,
          frequency_kind: !frequency_kind ? 'required' : undefined,
        }
      }));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO email_schedules
       (template_key, trigger_type, frequency_kind, interval_value, interval_unit, cron_expression, randomize_window_minutes, is_active, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [template_key, trigger_type, frequency_kind, interval_value || null, interval_unit || null, cron_expression || null, randomize_window_minutes, is_active, req.adminUser.id]
    );

    const newSchedule = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.schedule.manage',
      module: 'email',
      action: 'email.schedule_create',
      targetType: 'email_schedule',
      targetId: String(newSchedule.id),
      reason: `Created email schedule for template ${template_key}`,
    });

    await client.query('COMMIT');

    res.status(201).json({ schedule: newSchedule });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /admin/email/schedules/:id
router.patch('/schedules/:id', requirePermission('email.schedule.manage'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { trigger_type, frequency_kind, interval_value, interval_unit, cron_expression, randomize_window_minutes, is_active } = req.body;

    const { rows: existing } = await query('SELECT id FROM email_schedules WHERE id::text = $1', [id]);
    if (existing.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Email schedule not found.'));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE email_schedules
       SET trigger_type = COALESCE($1, trigger_type),
           frequency_kind = COALESCE($2, frequency_kind),
           interval_value = COALESCE($3, interval_value),
           interval_unit = COALESCE($4, interval_unit),
           cron_expression = COALESCE($5, cron_expression),
           randomize_window_minutes = COALESCE($6, randomize_window_minutes),
           is_active = COALESCE($7, is_active),
           updated_by = $8,
           updated_at = NOW()
       WHERE id::text = $9
       RETURNING *`,
      [trigger_type, frequency_kind, interval_value, interval_unit, cron_expression, randomize_window_minutes, is_active, req.adminUser.id, id]
    );

    const updatedSchedule = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.schedule.manage',
      module: 'email',
      action: 'email.schedule_update',
      targetType: 'email_schedule',
      targetId: String(id),
      reason: `Updated email schedule ${id}`,
    });

    await client.query('COMMIT');

    res.json({ schedule: updatedSchedule });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── CAMPAIGNS ─────────────────────────────────────────────────────────────────

// GET /admin/email/campaigns
router.get('/campaigns', requirePermission.any(['email.campaign.send', 'email.analytics.view']), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*, t.name as template_name
       FROM email_campaigns c
       LEFT JOIN email_templates t ON t.key = c.template_key
       ORDER BY c.created_at DESC`
    );
    res.json({ campaigns: rows });
  } catch (err) {
    next(err);
  }
});

// POST /admin/email/campaigns
router.post('/campaigns', requirePermission('email.campaign.send'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { template_key, segment_filter = {}, scheduled_at = null, status = 'draft' } = req.body;

    if (!template_key) {
      return next(new AppError('VALIDATION_ERROR', 400, { fields: { template_key: 'required' } }));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO email_campaigns (template_key, segment_filter, status, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [template_key, JSON.stringify(segment_filter), status, scheduled_at ? new Date(scheduled_at) : null, req.adminUser.id]
    );

    const newCampaign = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.campaign.send',
      module: 'email',
      action: 'email.campaign_create',
      targetType: 'email_campaign',
      targetId: String(newCampaign.id),
      reason: `Created campaign using template ${template_key}`,
    });

    await client.query('COMMIT');

    res.status(201).json({ campaign: newCampaign });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /admin/email/campaigns/:id/send-now
router.post('/campaigns/:id/send-now', requirePermission('email.campaign.send'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;

    const { rows: existing } = await query('SELECT id FROM email_campaigns WHERE id::text = $1', [id]);
    if (existing.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Email campaign not found.'));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE email_campaigns
       SET status = 'scheduled', scheduled_at = NOW()
       WHERE id::text = $1
       RETURNING *`,
      [id]
    );

    const updatedCampaign = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.campaign.send',
      module: 'email',
      action: 'email.campaign_send_now',
      targetType: 'email_campaign',
      targetId: String(id),
      reason: `Triggered send-now for campaign ${id}`,
    });

    await client.query('COMMIT');

    res.json({ campaign: updatedCampaign });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── ANALYTICS & SENDS ─────────────────────────────────────────────────────────

// GET /admin/email/analytics
router.get('/analytics', requirePermission('email.analytics.view'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        COUNT(*)::int as total_sends,
        COUNT(CASE WHEN status = 'sent' THEN 1 END)::int as sent_count,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::int as opened_count,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::int as clicked_count,
        COUNT(CASE WHEN status = 'bounced' THEN 1 END)::int as bounced_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END)::int as failed_count,
        COUNT(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 END)::int as unsubscribed_count
       FROM email_sends`
    );

    const stats = rows[0] || {
      total_sends: 0, sent_count: 0, opened_count: 0,
      clicked_count: 0, bounced_count: 0, failed_count: 0, unsubscribed_count: 0
    };

    const total = stats.total_sends || 1;
    const sent = stats.sent_count || 1;

    const open_rate = Number(((stats.opened_count / sent) * 100).toFixed(2));
    const click_rate = Number(((stats.clicked_count / sent) * 100).toFixed(2));

    res.json({
      analytics: {
        ...stats,
        open_rate,
        click_rate,
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/email/sends
router.get('/sends', requirePermission('email.analytics.view'), async (req, res, next) => {
  try {
    const { template_key, campaign_id, status, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));

    const conditions = [];
    const values = [];
    let idx = 1;

    if (template_key) {
      conditions.push(`template_key = $${idx++}`);
      values.push(template_key);
    }

    if (campaign_id) {
      conditions.push(`campaign_id::text = $${idx++}`);
      values.push(campaign_id);
    }

    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*)::int as total FROM email_sends ${whereClause}`, values);
    const totalCount = countRes.rows[0]?.total || 0;

    values.push(Math.min(100, parseInt(limit, 10)));
    values.push(offset);

    const { rows } = await query(
      `SELECT * FROM email_sends ${whereClause} ORDER BY sent_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );

    res.json({
      sends: rows,
      pagination: {
        page: Math.max(1, parseInt(page, 10)),
        limit: Math.min(100, parseInt(limit, 10)),
        total_count: totalCount,
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
