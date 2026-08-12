/**
 * Email Template Compiler Service — cpa-manage backend.
 * Powered by Handlebars (auto-escaped XSS protection), compile-time pre-validation,
 * payload schema validation, sanitize-html defense-in-depth, and direct DB live-column reads.
 */

const Handlebars = require('handlebars');
const sanitizeHtml = require('sanitize-html');
const { decode } = require('html-entities');
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
  user_registration_otp: {
    subject: '[Code+ Academy] Verify Your Account - Verification Code: {{otp_code}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #6366f1;">Welcome to Code+ Academy</h2><p>Hello <strong>{{display_name}}</strong>,</p><p>Thank you for signing up. Your 6-digit email verification code is:</p><div style="background: #1e1b4b; color: #818cf8; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 14px 20px; border-radius: 8px; display: inline-block; margin: 12px 0;">{{otp_code}}</div><p style="font-size: 12px; color: #64748b;">This OTP code will expire in {{expiry_minutes}} minutes.</p><p>Best regards,<br/>Code+ Academy Team</p></div>',
    available_placeholders: ['display_name', 'otp_code', 'expiry_minutes'],
  },
  password_reset_otp: {
    subject: '[Code+ Academy] Password Reset Code: {{otp_code}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #4f46e5;">Password Reset Verification Code</h2><p>Hello <strong>{{name}}</strong>,</p><p>You requested to reset your password. Use your 6-digit verification code below to proceed:</p><div style="background: #1e1b4b; color: #818cf8; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 14px 20px; border-radius: 8px; display: inline-block; margin: 12px 0;">{{otp_code}}</div><p style="font-size: 12px; color: #64748b;">This OTP code will expire in {{expiry_minutes}} minutes.</p><p>If you did not request this, please ignore this email.</p></div>',
    available_placeholders: ['name', 'otp_code', 'expiry_minutes'],
  },
  password_reset: {
    subject: '[Code+ Academy] Reset Your Account Password',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #4f46e5;">Password Reset Request</h2><p>Hello <strong>{{name}}</strong>,</p><p>We received a request to reset your password. Click the link below to set a new password:</p><p><a href="{{{reset_url}}}" style="background: #4f46e5; color: #fff; padding: 12px 22px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password Now</a></p><p style="font-size: 12px; color: #64748b; margin-top: 20px;">If you did not request this, please ignore this email.</p></div>',
    available_placeholders: ['name', 'reset_url'],
  },
  content_published_confirmation: {
    subject: '🎉 Your {{content_type}} "{{content_title}}" is Now Live!',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #10b981;">Content Published Successfully</h2><p>Hello <strong>{{display_name}}</strong>,</p><p>Great news! Your {{content_type}} <strong>"{{content_title}}"</strong> has passed compliance review and is now live on Code+ Academy.</p><p><a href="{{content_url}}" style="background: #10b981; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View Published Content</a></p><p>Best regards,<br/>Code+ Academy Creator Studio</p></div>',
    available_placeholders: ['display_name', 'content_type', 'content_title', 'content_url'],
  },

  // Careers & Hiring
  hiring_offer_letter: {
    subject: 'Congratulations! Official Offer Letter for {{#if position}}{{position}}{{else}}{{role}}{{/if}} at Code+ Academy',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 650px;"><h2 style="color: #10b981;">Offer of Employment</h2><p>Dear <strong>{{name}}</strong>,</p><p>We are thrilled to offer you the position of <strong>{{#if position}}{{position}}{{else}}{{role}}{{/if}}</strong> in the <strong>{{#if department}}{{department}}{{else}}{{company_name}}{{/if}}</strong> team at {{#if organization_name}}{{organization_name}}{{else}}Code+ Academy{{/if}} ({{holding_company}}).</p><div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 4px;"><strong>Start Date:</strong> {{#if startdate}}{{startdate}}{{else}}{{start_date}}{{/if}}<br/><strong>Duration:</strong> {{duration}}<br/><strong>Annual Base Compensation:</strong> {{#if salary}}{{salary}}{{else}}{{compensation}}{{/if}}<br/><strong>Offer Expiration:</strong> {{#if offer_deadline}}{{offer_deadline}}{{else}}{{deadline}}{{/if}}<br/><strong>Document Serial:</strong> {{serial_no}}</div><p>Signed by <strong>{{signatory}}</strong> ({{signatory_role}}).</p><p>Please review and access your official offer letter document below:</p><p><a href="{{#if offer_pdf_link}}{{{offer_pdf_link}}}{{else}}{{{pdf_url}}}{{/if}}" style="background: #10b981; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View & Download Offer PDF</a></p><p>Best regards,<br/><strong>Code+ Academy People Ops Team</strong></p></div>',
    available_placeholders: [
      'position', 'organization_name', 'name', 'department', 'holding_company',
      'startdate', 'duration', 'salary', 'offer_deadline', 'offer_pdf_link',
      'serial_no', 'signatory', 'signatory_role',
      'role', 'company_name', 'start_date', 'compensation', 'deadline', 'pdf_url', 'certificate_pdf_link', 'serial_number', 'signature_text'
    ],
  },
  hiring_certificate: {
    subject: '🎓 Congratulations! Your Certificate of Completion from Code+ Academy',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 650px;"><h2 style="color: #6366f1;">Certificate of Completion Issued</h2><p>Dear <strong>{{name}}</strong>,</p><p>Congratulations! Your official <strong>Certificate of Completion</strong> for <strong>{{#if position}}{{position}}{{else}}{{role}}{{/if}}</strong> at Code+ Academy has been successfully issued.</p><div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; margin: 16px 0; border-radius: 4px;"><strong>Certificate Serial No:</strong> {{serial_no}}<br/><strong>Issue Date:</strong> {{date}}</div><p>You can view, download, or share your official credential using the link below:</p><p><a href="{{#if certificate_pdf_link}}{{{certificate_pdf_link}}}{{else}}{{{pdf_url}}}{{/if}}" style="background: #6366f1; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View Official Certificate PDF</a></p><p>Best regards,<br/><strong>Code+ Academy Credentials Team</strong></p></div>',
    available_placeholders: ['name', 'position', 'role', 'serial_no', 'date', 'certificate_pdf_link', 'pdf_url', 'signatory'],
  },
  job_application_received: {
    subject: 'Application Received: {{#if position}}{{position}}{{else}}{{role}}{{/if}} at Code+ Academy',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6;"><h2 style="color: #4f46e5;">Application Confirmation</h2><p>Hello {{name}},</p><p>Thank you for applying for the <strong>{{#if position}}{{position}}{{else}}{{role}}{{/if}}</strong> position. Our recruiting team is reviewing your application and will be in touch soon.</p><p>Best regards,<br/>Code+ Academy Talent Acquisition</p></div>',
    available_placeholders: ['name', 'position', 'role'],
  },

  // Trust & Safety / Support
  moderation_action_notice: {
    subject: '[Notice] Administrative Moderation Action Taken - Case #{{ticket_id}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #4f46e5;">Code+ Academy Moderation Notice</h2><p>Hello {{name}},</p><p>An administrative moderation action (<strong>{{action_type}}</strong>) has been executed regarding content / case <strong>#{{ticket_id}}</strong>.</p>{{#if content_url}}<p><strong>Content Item:</strong> <a href="{{content_url}}" style="color: #4f46e5; text-decoration: underline;">{{content_url}}</a></p>{{/if}}<div style="background-color: #f8fafc; padding: 14px; border-left: 4px solid #4f46e5; margin: 16px 0; border-radius: 4px;"><strong>Justification & Compliance Reason:</strong><br/>{{reason}}</div><p style="font-size: 13px; color: #64748b;">If you believe this decision was made in error, you may file an appeal through your creator dashboard.</p><p>Best regards,<br/><strong>Code+ Academy Trust & Safety Team</strong></p></div>',
    available_placeholders: ['name', 'ticket_id', 'action_type', 'reason', 'content_url'],
  },
  temporary_takedown_7day: {
    subject: '[Action Required] 7-Day Temporary Content Takedown Notice - Ticket #{{ticket_id}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #d97706;">Temporary Content Unlisting Notice (7-Day Reply SLA)</h2><p>Hello {{name}},</p><p>Your content <strong>"{{content_title}}"</strong> (Case #{{ticket_id}}) has been temporarily unlisted following a compliance report.</p>{{#if content_url}}<p><strong>Content Item URL:</strong> <a href="{{content_url}}" style="color: #d97706; text-decoration: underline;">{{content_url}}</a></p>{{/if}}<div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; margin: 16px 0; border-radius: 4px;"><strong>Action Taken & Justification:</strong><br/>{{reason}}</div><p>You have <strong>7 days</strong> to resolve this issue or submit a formal response/counter-notice before permanent action is enforced.</p><p>Best regards,<br/><strong>Code+ Academy Support & Compliance Team</strong></p></div>',
    available_placeholders: ['name', 'content_title', 'ticket_id', 'reason', 'content_url'],
  },
  permanent_takedown_notice: {
    subject: '[Important] Permanent Content Removal Notice - Case #{{ticket_id}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #ef4444;">Permanent Content Takedown Notice</h2><p>Hello {{name}},</p><p>Following an administrative safety review, your content <strong>"{{content_title}}"</strong> (Case #{{ticket_id}}) has been <strong>permanently removed</strong> from Code+ Academy.</p>{{#if content_url}}<p><strong>Affected Content URL:</strong> <a href="{{content_url}}" style="color: #ef4444; text-decoration: underline;">{{content_url}}</a></p>{{/if}}<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px; margin: 16px 0; border-radius: 4px;"><strong>Violation & Removal Reason / Justification:</strong><br/>{{reason}}</div><p style="font-size: 13px; color: #64748b;">Repeated community guideline violations may lead to creator account suspension.</p><p>Best regards,<br/><strong>Code+ Academy Trust & Safety Compliance</strong></p></div>',
    available_placeholders: ['name', 'content_title', 'ticket_id', 'reason', 'content_url'],
  },
  copyright_infringement_notice: {
    subject: '[Copyright / DMCA Notice] Alleged Infringement Report - Case #{{ticket_id}}',
    html: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;"><h2 style="color: #dc2626;">DMCA / Copyright Infringement Notice</h2><p>Hello {{name}},</p><p>Code+ Academy has received an intellectual property infringement notification regarding your content <strong>"{{content_title}}"</strong> (Case #{{ticket_id}}).</p>{{#if content_url}}<p><strong>Reported Content Link:</strong> <a href="{{content_url}}" style="color: #dc2626; text-decoration: underline;">{{content_url}}</a></p>{{/if}}<div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 14px; margin: 16px 0; border-radius: 4px;"><strong>Copyright Complaint Details & Justification:</strong><br/>{{reason}}</div><p style="font-size: 13px; color: #475569;">As a result of this claim, the reported material has been disabled. You may submit a formal counter-notification under DMCA guidelines.</p><p>Best regards,<br/><strong>Code+ Academy Legal & IP Protection</strong></p></div>',
    available_placeholders: ['name', 'content_title', 'ticket_id', 'reason', 'content_url'],
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
  const strippedTags = sanitizeHtml(unescapedSubject, {
    allowedTags: [],
    allowedAttributes: {},
  });
  // Decode HTML entities FIRST so &#13;&#10; / &#xD;&#xA; are fully expanded
  const decoded = decode(strippedTags);
  // Prevent CRLF SMTP Header Injection (replace \r and \n with space as the ABSOLUTE LAST STEP)
  return decoded.replace(/[\r\n]+/g, ' ');
}

/**
 * Sanitize final compiled HTML (Defense-in-depth)
 * Allows standard HTML email tags and inline styles while stripping dangerous script/iframe/object tags.
 * Restricts data: URI scheme strictly to img src attributes.
 */
function sanitizeCompiledHtml(html) {
  return sanitizeHtml(html || '', {
    allowVulnerableTags: true,
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

const CRITICAL_TEMPLATE_KEYS = new Set(['admin_registration_otp', 'password_reset', 'password_reset_otp', '2fa_login_alert']);

const MOCK_SAMPLE_PAYLOADS = {
  content_published_confirmation: {
    display_name: 'Creator Partner',
    content_type: 'Video Tutorial',
    content_title: 'Introduction to Advanced Next.js Architecture',
    content_url: 'https://codeplusacademy.in/watch/nextjs-arch',
  },
  admin_registration_otp: {
    display_name: 'Admin User',
    otp_code: '849201',
    expiry_minutes: '15',
  },
  user_registration_otp: {
    display_name: 'New Student',
    otp_code: '582910',
    expiry_minutes: '15',
  },
  password_reset_otp: {
    name: 'Developer',
    otp_code: '492815',
    expiry_minutes: '15',
  },
  password_reset: {
    name: 'Developer',
    reset_url: 'https://codeplusacademy.in/reset-password?token=sample_test_token',
  },
  hiring_offer_letter: {
    name: 'Candidate',
    position: 'Senior Fullstack Engineer',
    department: 'Engineering',
    startdate: '2026-09-01',
    salary: '₹18,00,000 / yr',
    offer_deadline: '2026-08-20',
    offer_pdf_link: 'https://codeplusacademy.in/offers/sample-offer.pdf',
  },
  job_application_received: {
    name: 'Applicant',
    position: 'Frontend Engineer Intern',
  },
  moderation_action_notice: {
    name: 'User',
    ticket_id: 'TS-94820',
    action_type: 'Content Warning',
    reason: 'Community guidelines compliance check.',
  },
  temporary_takedown_7day: {
    name: 'Creator',
    content_title: 'React Patterns Guide',
    ticket_id: 'TS-94821',
    deadline_date: '2026-08-15',
    appeal_link: 'https://codeplusacademy.in/appeal?ticket=TS-94821',
  },
  friend_posted_video: {
    name: 'Learner',
    friend_name: 'Alex Rivera',
    content_title: 'Mastering PostgreSQL Indexing & Query Tuning',
    content_thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
    content_url: 'https://codeplusacademy.in/watch/postgres-tuning',
  },
};

/**
 * Hot-Path Email Send Function
 * Direct read from live columns (subject_template, body_html_template).
 */
async function sendTemplatedEmail({ templateKey, recipientEmail, payload = {}, userId = null, useDraft = false }) {
  try {
    let subjectTpl = DEFAULT_TEMPLATES[templateKey]?.subject || 'Notification from Code+ Academy';
    let bodyTpl = DEFAULT_TEMPLATES[templateKey]?.html || '<p>Hello {{display_name}}</p>';
    let availablePlaceholders = DEFAULT_TEMPLATES[templateKey]?.available_placeholders || [];
    let isCritical = CRITICAL_TEMPLATE_KEYS.has(templateKey);

    // Do NOT merge mock sample payloads into live production emails (Bug #2 fix)
    const mergedPayload = useDraft ? { ...MOCK_SAMPLE_PAYLOADS[templateKey], ...payload } : payload;

    let configuredSender = null;
    let configuredReplyTo = null;

    // Direct single-row query from live & draft columns.
    // LEFT JOIN sender_emails to resolve sender_email_id FK → actual "From" address.
    // Falls back to: template-linked sender → platform default sender → env var.
    const { rows } = await query(
      `SELECT
         t.subject_template, t.body_html_template,
         t.draft_subject_template, t.draft_body_html_template,
         t.reply_to_email, t.draft_reply_to_email,
         t.available_placeholders, t.is_system_locked,
         -- Resolve sender_email_id FK → display name + email (template-specific sender)
         se.email          AS linked_sender_email,
         se.display_name   AS linked_sender_name,
         -- Also resolve the platform default sender as a fallback
         sd.email          AS default_sender_email,
         sd.display_name   AS default_sender_name
       FROM email_templates t
       LEFT JOIN sender_emails se ON t.sender_email_id = se.id
       LEFT JOIN sender_emails sd ON sd.is_default = true
       WHERE LOWER(TRIM(t.key)) = LOWER(TRIM($1)) AND t.is_active = true
       LIMIT 1`,
      [templateKey]
    );

    if (rows.length > 0) {
      const r = rows[0];
      const dSub = r.draft_subject_template && r.draft_subject_template.trim() ? r.draft_subject_template : null;
      const dBody = r.draft_body_html_template && r.draft_body_html_template.trim() ? r.draft_body_html_template : null;
      const lSub = r.subject_template && r.subject_template.trim() ? r.subject_template : null;
      const lBody = r.body_html_template && r.body_html_template.trim() ? r.body_html_template : null;

      const dReply = r.draft_reply_to_email && r.draft_reply_to_email.trim() ? r.draft_reply_to_email : null;
      const lReply = r.reply_to_email && r.reply_to_email.trim() ? r.reply_to_email : null;

      const effSubject = (useDraft && dSub) ? dSub : lSub;
      const effBody = (useDraft && dBody) ? dBody : lBody;

      // Priority order for sender address resolution:
      //   1. Template-specific sender (sender_email_id FK → sender_emails.email)
      //   2. Platform default sender (sender_emails WHERE is_default = true)
      //   3. Env var / Resend account default (handled in sendMail() when from=undefined)
      const templateLinkedSender = r.linked_sender_email
        ? (r.linked_sender_name ? `${r.linked_sender_name} <${r.linked_sender_email}>` : r.linked_sender_email)
        : null;
      const platformDefaultSender = r.default_sender_email
        ? (r.default_sender_name ? `${r.default_sender_name} <${r.default_sender_email}>` : r.default_sender_email)
        : null;

      configuredSender = templateLinkedSender || platformDefaultSender || null;
      configuredReplyTo = (useDraft && dReply) ? dReply : lReply;

      if (effSubject) subjectTpl = effSubject;
      if (effBody) bodyTpl = effBody;
      if (r.available_placeholders && Array.isArray(r.available_placeholders)) {
        availablePlaceholders = r.available_placeholders;
      }
      if (r.is_system_locked) isCritical = true;
    }

    // Payload schema check
    const missingKeys = validatePayloadSchema(mergedPayload, availablePlaceholders);
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
    const compiledSubject = sanitizeSubjectText(subjectTpl, mergedPayload);
    const rawCompiledBody = Handlebars.compile(bodyTpl)(mergedPayload);

    // Defense-in-depth HTML sanitization
    const compiledBody = sanitizeCompiledHtml(rawCompiledBody);

    // Physical dispatch via Resend SDK
    const sendResult = await sendMail({
      to: recipientEmail,
      subject: compiledSubject,
      html: compiledBody,
      from: configuredSender || undefined,
      replyTo: configuredReplyTo || undefined,
    });
    // sendMail returns { success, messageId } or legacy boolean true/false
    const sentOk = (typeof sendResult === 'object' && sendResult !== null) ? sendResult.success : !!sendResult;

    // Safe logging in email_sends table (with fallback for legacy schema)
    try {
      await query(
        `INSERT INTO email_sends (template_key, user_id, recipient_email, subject, body_html, merged_payload, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [templateKey, userId, recipientEmail, compiledSubject, compiledBody, JSON.stringify(mergedPayload), sentOk ? 'sent' : 'failed']
      );
    } catch (dbLogErr) {
      await query(
        `INSERT INTO email_sends (template_key, user_id, status, sent_at)
         VALUES ($1, $2, $3, NOW())`,
        [templateKey, userId, sentOk ? 'sent' : 'failed']
      ).catch(() => {});
    }

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
  CRITICAL_TEMPLATE_KEYS,
};
