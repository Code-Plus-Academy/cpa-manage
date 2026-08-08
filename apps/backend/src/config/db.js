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
    body_html_template: '<div>Dear {{name}}, Offer for {{position}}</div>',
    available_placeholders: ['name', 'position', 'startdate'],
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
      if (lower.includes('from email_campaigns')) {
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

module.exports = { pool, query, getClient, mockSends, mockCampaigns };
