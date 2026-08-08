/**
 * Email Template Compiler Service — cpa-manage backend.
 * Powered by Handlebars (auto-escaped XSS protection), compile-time pre-validation,
 * payload schema validation, sanitize-html defense-in-depth, and direct DB live-column reads.
 */

const Handlebars = require('handlebars');
const sanitizeHtml = require('sanitize-html');
const { query } = require('../config/db');
const { sendMail } = require('./emailService');

// Default fallback templates
const DEFAULT_TEMPLATES = {
  admin_registration_otp: {
    subject: '[Code+ Academy] Complete Your Worker Admin Registration - Verification OTP: {{otp_code}}',
    html: '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><h2 style="color: #6366f1;">Worker Admin Account Registration</h2><p>Hello <strong>{{display_name}}</strong>,</p><p>You have been invited to join the Code+ Academy Administration console as a Worker Admin.</p><p>Your 6-digit One-Time Registration Passcode (OTP) is:</p><div style="background: #1e1b4b; color: #818cf8; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 14px 20px; border-radius: 8px; display: inline-block; margin: 12px 0;">{{otp_code}}</div><p style="font-size: 12px; color: #6b7280;">This OTP will expire in {{expiry_minutes}} minutes.</p><p>Best regards,<br/>Code+ Academy Administration</p></div>',
    available_placeholders: ['display_name', 'otp_code', 'expiry_minutes'],
  },
  moderation_action_notice: {
    subject: '[Notice] Administrative Moderation Action Taken - Case #{{ticket_id}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #4f46e5;">Code+ Academy Moderation Notice</h2><p>Hello {{name}},</p><p>An administrative moderation action (<strong>{{action_type}}</strong>) has been executed regarding content / case <strong>#{{ticket_id}}</strong>.</p><div style="background-color: #f8fafc; padding: 14px; border-left: 4px solid #4f46e5; margin: 16px 0; border-radius: 4px;"><strong>Justification & Compliance Reason:</strong><br/>{{reason}}</div><p style="font-size: 13px; color: #64748b;">If you believe this decision was made in error, you may file an appeal through your creator dashboard.</p><p>Best regards,<br/><strong>Code+ Academy Trust & Safety Team</strong></p></div>',
    available_placeholders: ['name', 'ticket_id', 'action_type', 'reason'],
  },
};

/**
 * Sanitize final compiled HTML (Defense-in-depth)
 * Allows standard HTML email tags and inline styles while stripping dangerous script/iframe/object tags.
 */
function sanitizeCompiledHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'style', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'hr', 'br', 'a', 'p', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li'
    ]),
    allowedAttributes: {
      '*': ['style', 'class', 'id', 'align', 'valign', 'bgcolor', 'width', 'height'],
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
  });
}

/**
 * Compile-time pre-validation for Admin Edit/Publish step.
 * Precompiles template with Handlebars and tests with mock placeholders.
 * Throws an error if syntax is invalid.
 */
function compileAndValidateTemplate({ subject_template, body_html_template, available_placeholders = [] }) {
  // Build mock payload from available_placeholders
  const mockPayload = {};
  if (Array.isArray(available_placeholders)) {
    available_placeholders.forEach(p => {
      mockPayload[p] = `[${p}_sample]`;
    });
  }

  try {
    // 1. Precompile and test Subject
    const subjectCompiled = Handlebars.compile(subject_template || '')(mockPayload);

    // 2. Precompile and test Body HTML
    const bodyCompiled = Handlebars.compile(body_html_template || '')(mockPayload);

    // 3. Sanitize compiled output test
    const sanitizedBody = sanitizeCompiledHtml(bodyCompiled);

    return {
      isValid: true,
      sampleSubject: subjectCompiled,
      sampleBodyHtml: sanitizedBody,
    };
  } catch (err) {
    throw new Error(`Handlebars Template Validation Error: ${err.message}`);
  }
}

/**
 * Validates payload object against template schema placeholders
 */
function validatePayloadSchema(payload, requiredPlaceholders = []) {
  const missing = [];
  if (Array.isArray(requiredPlaceholders)) {
    for (const key of requiredPlaceholders) {
      if (payload[key] === undefined || payload[key] === null) {
        missing.push(key);
      }
    }
  }
  return missing;
}

/**
 * Hot-Path Email Send Function
 * Direct read from live columns (subject_template, body_html_template).
 */
async function sendTemplatedEmail({ templateKey, recipientEmail, payload = {}, userId = null }) {
  try {
    let subjectTpl = DEFAULT_TEMPLATES[templateKey]?.subject || 'Notification from Code+ Academy';
    let bodyTpl = DEFAULT_TEMPLATES[templateKey]?.html || '<p>Hello {{display_name}}</p>';
    let availablePlaceholders = DEFAULT_TEMPLATES[templateKey]?.available_placeholders || [];

    // Direct single-row query from live columns (Hot Path — no joins)
    const { rows } = await query(
      `SELECT subject_template, body_html_template, available_placeholders 
       FROM email_templates 
       WHERE key = $1 AND is_active = true`,
      [templateKey]
    );

    if (rows.length > 0) {
      if (rows[0].subject_template) subjectTpl = rows[0].subject_template;
      if (rows[0].body_html_template) bodyTpl = rows[0].body_html_template;
      if (rows[0].available_placeholders && Array.isArray(rows[0].available_placeholders)) {
        availablePlaceholders = rows[0].available_placeholders;
      }
    }

    // Payload schema check
    const missingKeys = validatePayloadSchema(payload, availablePlaceholders);
    if (missingKeys.length > 0) {
      console.warn(`[emailTemplateCompiler] WARNING: Missing payload keys [${missingKeys.join(', ')}] for template '${templateKey}'`);
    }

    // Handlebars Compilation with auto-escaping for XSS protection
    const compiledSubject = Handlebars.compile(subjectTpl)(payload);
    const rawCompiledBody = Handlebars.compile(bodyTpl)(payload);

    // Defense-in-depth HTML sanitization
    const compiledBody = sanitizeCompiledHtml(rawCompiledBody);

    // Physical dispatch via Resend SDK
    const sentOk = await sendMail({
      to: recipientEmail,
      subject: compiledSubject,
      html: compiledBody,
    });

    // Log send event in email_sends table
    await query(
      `INSERT INTO email_sends (template_key, user_id, recipient_email, subject, body_html, merged_payload, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [templateKey, userId, recipientEmail, compiledSubject, compiledBody, JSON.stringify(payload), sentOk ? 'sent' : 'failed']
    );

    return sentOk;
  } catch (err) {
    console.error(`[emailTemplateCompiler] Error sending template '${templateKey}' to ${recipientEmail}:`, err.message || err);
    return false;
  }
}

module.exports = {
  sendTemplatedEmail,
  compileAndValidateTemplate,
  sanitizeCompiledHtml,
  validatePayloadSchema,
  DEFAULT_TEMPLATES,
};
