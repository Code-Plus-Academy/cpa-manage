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

const { compileAndValidateTemplate } = require('../services/emailTemplateCompiler');

// POST /admin/email/templates
router.post('/templates', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { key, name, category, subject_template, body_html_template, available_placeholders = [], is_active = true, is_system_locked = false } = req.body;

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

    const ALLOWED_CATEGORIES = ['transactional', 'security', 'promotional', 'hiring', 'support', 'social'];
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return next(new AppError('VALIDATION_ERROR', 400, null, `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`));
    }

    const { rows: existing } = await query('SELECT id FROM email_templates WHERE key = $1', [key.trim()]);
    if (existing.length > 0) {
      return next(new AppError('CONFLICT', 409, null, 'An email template with this key already exists.'));
    }

    // Compile-time pre-validation on save
    try {
      compileAndValidateTemplate({ subject_template, body_html_template, available_placeholders });
    } catch (valErr) {
      return next(new AppError('VALIDATION_ERROR', 400, null, valErr.message));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO email_templates (key, name, category, subject_template, body_html_template, draft_subject_template, draft_body_html_template, available_placeholders, is_system_locked, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $4, $5, $6::jsonb, $7, $8, $9)
       RETURNING *`,
      [key.trim(), name.trim(), category, subject_template, body_html_template, JSON.stringify(available_placeholders), !!is_system_locked, is_active, req.adminUser.id]
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

// PATCH /admin/email/templates/:key (Save Draft / Edit)
router.patch('/templates/:key', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { key } = req.params;
    const { name, category, subject_template, body_html_template, available_placeholders, is_active } = req.body;

    const { rows: existingRows } = await query('SELECT * FROM email_templates WHERE key = $1', [key]);
    if (existingRows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Email template not found.'));
    }

    const existing = existingRows[0];

    // Enforce system lock
    if (existing.is_system_locked && !req.adminUser.is_root) {
      return next(new AppError('FORBIDDEN', 403, null, 'Template is system-locked and can only be modified by Superadmin.'));
    }

    const nextSubject = subject_template !== undefined ? subject_template : (existing.draft_subject_template || existing.subject_template);
    const nextBody = body_html_template !== undefined ? body_html_template : (existing.draft_body_html_template || existing.body_html_template);
    const nextPlaceholders = available_placeholders !== undefined ? available_placeholders : (existing.available_placeholders || []);

    // Compile-time validation
    try {
      compileAndValidateTemplate({ subject_template: nextSubject, body_html_template: nextBody, available_placeholders: nextPlaceholders });
    } catch (valErr) {
      return next(new AppError('VALIDATION_ERROR', 400, null, valErr.message));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE email_templates
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           draft_subject_template = $3,
           draft_body_html_template = $4,
           available_placeholders = COALESCE($5::jsonb, available_placeholders),
           is_active = COALESCE($6, is_active),
           updated_at = NOW()
       WHERE key = $7
       RETURNING *`,
      [name, category, nextSubject, nextBody, JSON.stringify(nextPlaceholders), is_active, key]
    );

    const updatedTemplate = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.templates.edit',
      module: 'email',
      action: 'email.template_draft_save',
      targetType: 'email_template',
      targetId: key,
      reason: `Saved draft for email template ${key}`,
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

// POST /admin/email/templates/:key/publish (Copy Draft → Live & Snapshot Version)
router.post('/templates/:key/publish', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { key } = req.params;

    const { rows: existingRows } = await query('SELECT * FROM email_templates WHERE key = $1', [key]);
    if (existingRows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Email template not found.'));
    }

    const existing = existingRows[0];

    if (existing.is_system_locked && !req.adminUser.is_root) {
      return next(new AppError('FORBIDDEN', 403, null, 'Template is system-locked and can only be published by Superadmin.'));
    }

    const liveSubject = existing.draft_subject_template || existing.subject_template;
    const liveBody = existing.draft_body_html_template || existing.body_html_template;

    // Validate before publish
    compileAndValidateTemplate({
      subject_template: liveSubject,
      body_html_template: liveBody,
      available_placeholders: existing.available_placeholders || [],
    });

    await client.query('BEGIN');

    const nextVersion = (existing.version || 1) + 1;

    // Archive snapshot in email_template_versions
    await client.query(
      `INSERT INTO email_template_versions (template_key, version, subject_template, body_html_template, published_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (template_key, version) DO NOTHING`,
      [key, existing.version, existing.subject_template, existing.body_html_template, req.adminUser.id]
    );

    // Promote draft → live and clear draft columns
    const { rows } = await client.query(
      `UPDATE email_templates
       SET subject_template = $1,
           body_html_template = $2,
           draft_subject_template = NULL,
           draft_body_html_template = NULL,
           version = $3,
           updated_at = NOW()
       WHERE key = $4
       RETURNING *`,
      [liveSubject, liveBody, nextVersion, key]
    );

    const publishedTemplate = rows[0];

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.templates.edit',
      module: 'email',
      action: 'email.template_publish',
      targetType: 'email_template',
      targetId: key,
      reason: `Published version ${nextVersion} for email template ${key}`,
    });

    await client.query('COMMIT');

    res.json({ template: publishedTemplate, message: `Template ${key} published successfully as v${nextVersion}.` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /admin/email/templates/:key
router.delete('/templates/:key', requirePermission('email.templates.edit'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { key } = req.params;

    const { rows: existingRows } = await query('SELECT * FROM email_templates WHERE key = $1', [key]);
    if (existingRows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Email template not found.'));
    }

    const existing = existingRows[0];
    if (existing.is_system_locked && !req.adminUser.is_root) {
      return next(new AppError('FORBIDDEN', 403, null, 'Template is system-locked and cannot be deleted.'));
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM email_templates WHERE key = $1', [key]);

    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'email.templates.edit',
      module: 'email',
      action: 'email.template_delete',
      targetType: 'email_template',
      targetId: key,
      reason: `Deleted email template ${key}`,
    });

    await client.query('COMMIT');
    res.json({ message: `Template ${key} deleted successfully.` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /admin/email/templates/render-preview — Test Handlebars render with mock payload
router.post('/templates/render-preview', requirePermission.any(['email.templates.edit', 'email.analytics.view']), async (req, res, next) => {
  try {
    const { subject_template, body_html_template, payload = {} } = req.body;
    const Handlebars = require('handlebars');
    const { sanitizeCompiledHtml } = require('../services/emailTemplateCompiler');

    const renderedSubject = Handlebars.compile(subject_template || '')(payload);
    const rawBody = Handlebars.compile(body_html_template || '')(payload);
    const renderedBody = sanitizeCompiledHtml(rawBody);

    res.json({
      rendered_subject: renderedSubject,
      rendered_body_html: renderedBody,
    });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// POST /admin/email/templates/:key/test-send — Send real test email to admin inbox
router.post('/templates/:key/test-send', requirePermission('email.templates.edit'), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { recipient_email, payload = {} } = req.body;
    const { sendTemplatedEmail } = require('../services/emailTemplateCompiler');

    const targetEmail = recipient_email || req.adminUser.email;
    const sentOk = await sendTemplatedEmail({
      templateKey: key,
      recipientEmail: targetEmail,
      payload,
      userId: req.adminUser.id,
      useDraft: true,
    });

    if (sentOk) {
      res.json({ message: `Test email sent successfully to ${targetEmail}.` });
    } else {
      res.status(500).json({ error: { message: `Failed to send test email to ${targetEmail}.` } });
    }
  } catch (err) {
    next(err);
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
