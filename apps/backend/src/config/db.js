/**
 * PostgreSQL connection pool for the Social DB.
 * Includes local dev fallback when DB server is offline.
 */
const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  connectionString: config.DATABASE_URL || 'postgresql://localhost:5432/cpa_manage',
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[Social DB] Unexpected pool error:', err.message);
});

// Dev fallback in-memory store
const mockSends = [
  {
    id: 'send-1',
    user_id: 'user-101',
    template_key: 'admin_registration_otp',
    recipient_email: 'admin@codeplusacademy.in',
    subject: '[Code+ Academy] Verification OTP: 849201',
    body_html: '<p>Your OTP is 849201</p>',
    status: 'sent',
    sent_at: new Date(Date.now() - 3600000).toISOString(),
    opened_at: null,
    clicked_at: null,
    unsubscribed_at: null,
  },
  {
    id: 'send-2',
    user_id: 'user-102',
    template_key: 'hiring_offer_letter',
    recipient_email: 'candidate@example.com',
    subject: 'Offer Letter for Senior Backend Engineer',
    body_html: '<p>Offer details</p>',
    status: 'sent',
    sent_at: new Date(Date.now() - 7200000).toISOString(),
    opened_at: null,
    clicked_at: null,
    unsubscribed_at: null,
  },
  {
    id: 'send-3',
    user_id: 'user-103',
    template_key: 'moderation_action_notice',
    recipient_email: 'creator@example.com',
    subject: '[Notice] Moderation Action Taken - Case #8492',
    body_html: '<p>Moderation notice</p>',
    status: 'failed',
    sent_at: new Date(Date.now() - 10800000).toISOString(),
    opened_at: null,
    clicked_at: null,
    unsubscribed_at: null,
  }
];

const mockTemplates = [
  {
    id: 'tpl-1',
    key: 'admin_registration_otp',
    name: 'Admin Registration OTP',
    category: 'security',
    subject_template: '[Code+ Academy] Complete Your Registration - Verification OTP: {{otp_code}}',
    body_html_template: '<div>Hello {{display_name}}, OTP: {{otp_code}}</div>',
    available_placeholders: ['display_name', 'otp_code', 'expiry_minutes'],
    is_system_locked: true,
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'tpl-2',
    key: 'hiring_offer_letter',
    name: 'Hiring Offer Letter',
    category: 'hiring',
    subject_template: 'Offer Letter for {{position}} at Code+ Academy',
    body_html_template: '<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 650px;"><h2 style="color: #10b981;">Offer of Employment</h2><p>Dear <strong>{{name}}</strong>,</p><p>We are thrilled to offer you the position of <strong>{{position}}</strong> in the <strong>{{department}}</strong> team at {{organization_name}} ({{holding_company}}).</p><div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 4px;"><strong>Start Date:</strong> {{startdate}}<br/><strong>Duration:</strong> {{duration}}<br/><strong>Annual Base Compensation:</strong> {{salary}}<br/><strong>Offer Expiration:</strong> {{offer_deadline}}<br/><strong>Serial No:</strong> {{serial_no}}</div><p>Signed by <strong>{{signatory}}</strong> ({{signatory_role}}).</p><p><a href="{{offer_pdf_link}}" style="background: #10b981; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View & Download Offer PDF</a></p></div>',
    available_placeholders: [
      'position', 'organization_name', 'name', 'department', 'holding_company',
      'startdate', 'duration', 'salary', 'offer_deadline', 'offer_pdf_link',
      'serial_no', 'signatory', 'signatory_role',
      'role', 'company_name', 'start_date', 'compensation', 'deadline', 'pdf_url', 'certificate_pdf_link', 'serial_number', 'signature_text'
    ],
    is_system_locked: false,
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
  }
];

const mockCampaigns = [];
const mockSchedules = [];

const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message.includes('connect ECONNREFUSED') || err.message.includes('connect ETIMEDOUT')) {
      const lower = text.toLowerCase();
      if (lower.includes('insert into email_sends')) {
        const newSend = {
          id: `send-${Date.now()}`,
          template_key: params ? params[0] : 'admin_registration_otp',
          user_id: params ? params[1] : null,
          recipient_email: params ? params[2] : 'admin@codeplusacademy.in',
          subject: params ? params[3] : 'Test Send Subject',
          body_html: params ? params[4] : '<p>Test</p>',
          status: params && params[6] ? params[6] : 'sent',
          sent_at: new Date().toISOString(),
          opened_at: null,
          clicked_at: null,
          unsubscribed_at: null,
        };
        mockSends.unshift(newSend);
        return { rows: [newSend] };
      }
      if (lower.includes('from email_sends')) {
        if (lower.includes('count(')) {
          const total_sends = mockSends.length;
          const sent_count = mockSends.filter(s => s.status === 'sent').length;
          const failed_count = mockSends.filter(s => s.status === 'failed').length;
          const bounced_count = mockSends.filter(s => s.status === 'bounced').length;
          return {
            rows: [{
              total: total_sends,
              total_sends,
              sent_count,
              opened_count: 0,
              clicked_count: 0,
              bounced_count,
              failed_count,
              unsubscribed_count: 0,
            }]
          };
        }
        return { rows: mockSends };
      }
      if (lower.includes('from email_templates')) {
        return { rows: mockTemplates };
      }
      if (lower.includes('insert into email_campaigns')) {
        const newCmp = {
          id: params ? params[0] : 'cmp-1',
          name: params ? params[1] : 'Sample Campaign',
          template_key: params ? params[2] : 'admin_registration_otp',
          segment_filter: params ? params[3] : 'all_users',
          status: params ? params[4] : 'scheduled',
          created_at: new Date().toISOString(),
        };
        mockCampaigns.unshift(newCmp);
        return { rows: [newCmp] };
      }
      if (lower.includes('from email_campaigns')) {
        if (params && params[0]) {
          return { rows: mockCampaigns.filter(c => c.id === params[0]) };
        }
        return { rows: mockCampaigns };
      }
      if (lower.includes('from email_schedules')) {
        return { rows: mockSchedules };
      }
      if (lower.includes('from admin_users')) {
        return { rows: [{ id: '1', email: 'admin@codeplusacademy.in', display_name: 'Root Admin', is_root: true, status: 'active' }] };
      }
      return { rows: [] };
    }
    console.error(`[DB QUERY ERROR] ${text.substring(0, 80)}...`, err.message);
    throw err;
  }
};

const getClient = async () => {
  try {
    return await pool.connect();
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message.includes('connect ECONNREFUSED') || err.message.includes('connect ETIMEDOUT')) {
      return {
        query: async (text, params) => query(text, params),
        release: () => {},
      };
    }
    throw err;
  }
};

/**
 * Content DB connection pool (feed_videos, articles, courses, etc.)
 * Set CONTENT_DATABASE_URL in Render environment variables.
 */
let contentPool = null;
if (process.env.CONTENT_DATABASE_URL) {
  contentPool = new Pool({
    connectionString: process.env.CONTENT_DATABASE_URL,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  contentPool.on('error', (err) => {
    console.error('[Content DB] Unexpected pool error:', err.message);
  });
}

const contentQuery = async (text, params) => {
  if (!contentPool) {
    throw new Error('CONTENT_DATABASE_URL not configured — Content DB queries unavailable');
  }
  return contentPool.query(text, params);
};

module.exports = { pool, query, getClient, contentQuery, mockSends, mockCampaigns };
