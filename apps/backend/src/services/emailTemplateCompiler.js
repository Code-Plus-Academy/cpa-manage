/**
 * Email Template Compiler Service — cpa-manage backend.
 * Powered by Handlebars (auto-escaped XSS protection), compile-time pre-validation,
 * payload schema validation, sanitize-html defense-in-depth, and direct DB live-column reads.
 */

const Handlebars = require('handlebars');
const sanitizeHtml = require('sanitize-html');
const { query } = require('../config/db');
const { sendMail } = require('./emailService');

// Default fallback templates across all platform domains
const DEFAULT_TEMPLATES = {
  // Auth & Security
  admin_registration_otp: {
    subject: '[Code+ Academy] Complete Your Worker Admin Registration - Verification OTP: {{otp_code}}',
    html: '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><h2 style="color: #6366f1;">Worker Admin Account Registration</h2><p>Hello <strong>{{display_name}}</strong>,</p><p>You have been invited to join the Code+ Academy Administration console as a Worker Admin.</p><p>Your 6-digit One-Time Registration Passcode (OTP) is:</p><div style="background: #1e1b4b; color: #818cf8; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 14px 20px; border-radius: 8px; display: inline-block; margin: 12px 0;">{{otp_code}}</div><p style="font-size: 12px; color: #6b7280;">This OTP will expire in {{expiry_minutes}} minutes.</p><p>Best regards,<br/>Code+ Academy Administration</p></div>',
    available_placeholders: ['display_name', 'otp_code', 'expiry_minutes'],
  },
  password_reset: {
    subject: '[Code+ Academy] Reset Your Account Password',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6;"><h2 style="color: #4f46e5;">Password Reset Request</h2><p>Hello {{name}},</p><p>We received a request to reset your password. Click the link below to set a new password:</p><p><a href="{{reset_url}}" style="background: #4f46e5; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a></p><p style="font-size: 12px; color: #64748b;">If you did not request this, please ignore this email.</p></div>',
    available_placeholders: ['name', 'reset_url'],
  },

  // Careers & Hiring
  hiring_offer_letter: {
    subject: 'Congratulations! Official Offer Letter for {{position}} at Code+ Academy',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 650px;"><h2 style="color: #10b981;">Offer of Employment</h2><p>Dear <strong>{{name}}</strong>,</p><p>We are thrilled to offer you the position of <strong>{{position}}</strong> in the <strong>{{department}}</strong> team at Code+ Academy.</p><div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 4px;"><strong>Start Date:</strong> {{startdate}}<br/><strong>Annual Base Compensation:</strong> {{salary}}<br/><strong>Offer Expiration:</strong> {{offer_deadline}}</div><p>Please review and sign your official offer letter package attached below.</p><p><a href="{{offer_pdf_link}}" style="background: #10b981; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View & Sign Offer PDF</a></p><p>Best regards,<br/><strong>Code+ Academy People Ops Team</strong></p></div>',
    available_placeholders: ['name', 'position', 'department', 'startdate', 'salary', 'offer_deadline', 'offer_pdf_link'],
  },
  job_application_received: {
    subject: 'Application Received: {{position}} at Code+ Academy',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6;"><h2 style="color: #4f46e5;">Application Confirmation</h2><p>Hello {{name}},</p><p>Thank you for applying for the <strong>{{position}}</strong> position. Our recruiting team is reviewing your application and will be in touch soon.</p><p>Best regards,<br/>Code+ Academy Talent Acquisition</p></div>',
    available_placeholders: ['name', 'position'],
  },

  // Trust & Safety / Support
  moderation_action_notice: {
    subject: '[Notice] Administrative Moderation Action Taken - Case #{{ticket_id}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #4f46e5;">Code+ Academy Moderation Notice</h2><p>Hello {{name}},</p><p>An administrative moderation action (<strong>{{action_type}}</strong>) has been executed regarding content / case <strong>#{{ticket_id}}</strong>.</p><div style="background-color: #f8fafc; padding: 14px; border-left: 4px solid #4f46e5; margin: 16px 0; border-radius: 4px;"><strong>Justification & Compliance Reason:</strong><br/>{{reason}}</div><p style="font-size: 13px; color: #64748b;">If you believe this decision was made in error, you may file an appeal through your creator dashboard.</p><p>Best regards,<br/><strong>Code+ Academy Trust & Safety Team</strong></p></div>',
    available_placeholders: ['name', 'ticket_id', 'action_type', 'reason'],
  },
  temporary_takedown_7day: {
    subject: '[Action Required] 7-Day Temporary Content Takedown Notice - Ticket #{{ticket_id}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6;"><h2 style="color: #d97706;">Temporary Content Unlisting Notice</h2><p>Hello {{name}},</p><p>Your content <strong>"{{content_title}}"</strong> has been temporarily unlisted following a compliance report.</p><p>You have <strong>7 days</strong> (until {{deadline_date}}) to submit a counter-notice or response via your creator panel.</p><p><a href="{{appeal_link}}" style="background: #d97706; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Submit Counter Notice</a></p></div>',
    available_placeholders: ['name', 'content_title', 'ticket_id', 'deadline_date', 'appeal_link'],
  },

  // Social & Community Activity
  friend_posted_video: {
    subject: '🎬 {{friend_name}} just posted a new video: "{{content_title}}"',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #6366f1;">New Content Alert</h2><p>Hello {{name}},</p><p>Your friend <strong>{{friend_name}}</strong> just uploaded a new video on Code+ Academy:</p><div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin: 16px 0;"><img src="{{content_thumbnail}}" alt="Thumbnail" style="width: 100%; height: 200px; object-fit: cover;" /><div style="padding: 14px;"><h3 style="margin: 0; color: #1e293b;">{{content_title}}</h3><p><a href="{{content_url}}" style="color: #6366f1; font-weight: bold;">Watch Video Now ➔</a></p></div></div></div>',
    available_placeholders: ['name', 'friend_name', 'content_title', 'content_thumbnail', 'content_url'],
  },
  suggested_friends_recommendation: {
    subject: '👥 People You May Know on Code+ Academy',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #6366f1;">Connect & Collaborate</h2><p>Hello {{name}},</p><p>Here are creators and peers suggested for you to follow on Code+ Academy:</p><ul style="list-style: none; padding: 0;">{{#each suggested_friends}}<li style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>{{this.name}}</strong> — {{this.bio}}</li>{{/each}}</ul></div>',
    available_placeholders: ['name', 'suggested_friends'],
  },

  // Promotional & Broadcast
  platform_announcement: {
    subject: '[Announcement] {{announcement_title}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 650px;"><h1 style="color: #4f46e5;">{{announcement_title}}</h1><img src="{{hero_image_url}}" alt="Hero" style="width: 100%; border-radius: 8px; margin: 16px 0;" /><p>Hello {{name}},</p><p>{{announcement_body}}</p><p><a href="{{action_link}}" style="background: #4f46e5; color: #fff; padding: 12px 22px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">{{action_button_text}}</a></p></div>',
    available_placeholders: ['name', 'announcement_title', 'hero_image_url', 'announcement_body', 'action_link', 'action_button_text'],
  },
};

/**
 * Sanitize email subject line (Strips ALL HTML tags for plain text subject lines)
 * Uses noEscape: true on Handlebars compile so scalar values like "Tom & Jerry"
 * remain unescaped plain text instead of entity-encoded "&amp;".
 */
function sanitizeSubjectText(subjectTpl, payload = {}) {
  const unescapedSubject = Handlebars.compile(subjectTpl || '', { noEscape: true })(payload);
  const strippedSubject = sanitizeHtml(unescapedSubject, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return strippedSubject
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Sanitize final compiled HTML (Defense-in-depth)
 * Allows standard HTML email tags and inline styles while stripping dangerous script/iframe/object tags.
 * Restricts data: URI scheme strictly to img src attributes.
 */
function sanitizeCompiledHtml(html) {
  return sanitizeHtml(html || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'style', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'hr', 'br', 'a', 'p', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li'
    ]),
    allowedAttributes: {
      '*': ['style', 'class', 'id', 'align', 'valign', 'bgcolor', 'width', 'height'],
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'mailto', 'data'],
    },
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
    const sanitizedSubject = sanitizeSubjectText(subject_template || '', mockPayload);

    // 2. Precompile and test Body HTML
    const bodyCompiled = Handlebars.compile(body_html_template || '')(mockPayload);

    // 3. Sanitize compiled output test
    const sanitizedBody = sanitizeCompiledHtml(bodyCompiled);

    return {
      isValid: true,
      sampleSubject: sanitizedSubject,
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

const CRITICAL_TEMPLATE_KEYS = new Set(['admin_registration_otp', 'password_reset', '2fa_login_alert']);

/**
 * Hot-Path Email Send Function
 * Direct read from live columns (subject_template, body_html_template).
 */
async function sendTemplatedEmail({ templateKey, recipientEmail, payload = {}, userId = null }) {
  try {
    let subjectTpl = DEFAULT_TEMPLATES[templateKey]?.subject || 'Notification from Code+ Academy';
    let bodyTpl = DEFAULT_TEMPLATES[templateKey]?.html || '<p>Hello {{display_name}}</p>';
    let availablePlaceholders = DEFAULT_TEMPLATES[templateKey]?.available_placeholders || [];
    let isCritical = CRITICAL_TEMPLATE_KEYS.has(templateKey);

    // Direct single-row query from live columns (Hot Path — no joins)
    const { rows } = await query(
      `SELECT subject_template, body_html_template, available_placeholders, is_system_locked 
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
      if (rows[0].is_system_locked) isCritical = true;
    }

    // Payload schema check
    const missingKeys = validatePayloadSchema(payload, availablePlaceholders);
    if (missingKeys.length > 0) {
      const errorMsg = `[emailTemplateCompiler] CRITICAL PAYLOAD ERROR: Missing required keys [${missingKeys.join(', ')}] for template '${templateKey}' (userId: ${userId || 'N/A'})`;
      if (isCritical) {
        console.error(errorMsg);
        throw new Error(errorMsg);
      } else {
        console.warn(`[emailTemplateCompiler] WARNING: Missing payload keys [${missingKeys.join(', ')}] for template '${templateKey}'`);
      }
    }

    // Handlebars Compilation with auto-escaping for XSS protection
    const compiledSubject = sanitizeSubjectText(subjectTpl, payload);
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
  sanitizeSubjectText,
  validatePayloadSchema,
  DEFAULT_TEMPLATES,
};
