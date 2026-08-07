/**
 * Email Template Compiler Service — cpa-manage backend.
 * Fetches dynamic templates from email_templates DB table, compiles placeholders,
 * logs to email_sends DB table, and dispatches via emailService.sendMail.
 */
const { query } = require('../config/db');
const { sendMail } = require('./emailService');

const DEFAULT_TEMPLATES = {
  admin_registration_otp: {
    subject: '[Code+ Academy] Complete Your Worker Admin Registration - Verification OTP: {{otp_code}}',
    html: '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><h2 style="color: #6366f1;">Worker Admin Account Registration</h2><p>Hello {{display_name}},</p><p>You have been invited to join the Code+ Academy Administration console as a Worker Admin.</p><p>Your 6-digit One-Time Registration Passcode (OTP) is:</p><div style="background: #1e1b4b; color: #818cf8; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 14px 20px; border-radius: 8px; display: inline-block; margin: 12px 0;">{{otp_code}}</div><p style="font-size: 12px; color: #6b7280;">This OTP will expire in {{expiry_minutes}} minutes.</p><p>Best regards,<br/>Code+ Academy Administration</p></div>',
  },
};

function renderTemplate(str, payload = {}) {
  if (!str) return '';
  let result = str;
  Object.keys(payload).forEach(k => {
    const val = payload[k] != null ? String(payload[k]) : '';
    const regex = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
    result = result.replace(regex, val);
  });
  return result;
}

async function sendTemplatedEmail({ templateKey, recipientEmail, payload = {}, userId = null }) {
  try {
    let subjectTemplate = DEFAULT_TEMPLATES[templateKey]?.subject || 'Notification from Code+ Academy';
    let bodyTemplate = DEFAULT_TEMPLATES[templateKey]?.html || '<p>Hello {{display_name}}</p>';

    // Fetch dynamic template from DB if available
    const { rows } = await query(
      `SELECT subject_template, body_html_template FROM email_templates WHERE key = $1 AND is_active = true`,
      [templateKey]
    );

    if (rows.length > 0) {
      if (rows[0].subject_template) subjectTemplate = rows[0].subject_template;
      if (rows[0].body_html_template) bodyTemplate = rows[0].body_html_template;
    }

    const compiledSubject = renderTemplate(subjectTemplate, payload);
    const compiledBody = renderTemplate(bodyTemplate, payload);

    // Send physical email via Resend SDK
    const sentOk = await sendMail({
      to: recipientEmail,
      subject: compiledSubject,
      html: compiledBody,
    });

    // Log to email_sends DB table
    await query(
      `INSERT INTO email_sends (template_key, user_id, recipient_email, subject, body_html, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [templateKey, userId, recipientEmail, compiledSubject, compiledBody, sentOk ? 'sent' : 'failed']
    );

    return sentOk;
  } catch (err) {
    console.error(`[emailTemplateCompiler] Error sending template ${templateKey} to ${recipientEmail}:`, err);
    return false;
  }
}

module.exports = { sendTemplatedEmail, renderTemplate };
