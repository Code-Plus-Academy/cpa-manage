/**
 * One-time seed script for email_templates table.
 * Imports DEFAULT_TEMPLATES directly from emailTemplateCompiler.js (Single Source of Truth)
 * and seeds them into the database using ON CONFLICT (key) DO NOTHING.
 */
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/cpa_manage';
if (!process.env.ADMIN_SESSION_SECRET) process.env.ADMIN_SESSION_SECRET = 'test_secret';

const { query } = require('../config/db');
const { DEFAULT_TEMPLATES } = require('../services/emailTemplateCompiler');

async function seedDefaultTemplates() {
  console.log('--- Seeding DEFAULT_TEMPLATES into email_templates DB table ---');

  const entries = Object.entries(DEFAULT_TEMPLATES);
  let inserted = 0;

  for (const [key, tpl] of entries) {
    const category = tpl.category || (
      key.includes('otp') || key.includes('password') || key.includes('2fa') ? 'security' :
      key.includes('moderation') ? 'support' : 'transactional'
    );
    const name = tpl.name || key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const res = await query(
      `INSERT INTO email_templates 
         (key, name, category, subject_template, body_html_template, available_placeholders, version, is_active, is_system_locked, updated_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6, 1, true, $7, NOW())
       ON CONFLICT (key) DO UPDATE
       SET available_placeholders = EXCLUDED.available_placeholders,
           updated_at = NOW()
       RETURNING key`,
      [
        key,
        name,
        category,
        tpl.subject,
        tpl.html,
        JSON.stringify(tpl.available_placeholders || []),
        ['admin_registration_otp', 'password_reset', '2fa_login_alert'].includes(key)
      ]
    );

    if (res.rows.length > 0) {
      inserted++;
      console.log(`- Seeded template '${key}' (${name})`);
    }
  }

  console.log(`\nSUCCESS: Seeded ${inserted} default templates into database.`);
}

if (require.main === module) {
  seedDefaultTemplates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDefaultTemplates };
