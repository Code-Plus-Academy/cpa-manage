/**
 * disable_2fa.js — Disable 2FA (TOTP) for an admin account.
 *
 * Usage:
 *   node disable_2fa.js <adminEmail> [databaseUrl]
 *   node disable_2fa.js --all [databaseUrl]
 *
 * Example:
 *   node disable_2fa.js root@codeplusacademy.in "postgresql://..."
 */

const { Pool } = require('pg');
require('dotenv').config();

async function disable2FA() {
  const targetEmail = process.argv[2];
  const dbUrl = process.argv[3] || process.env.DATABASE_URL;

  if (!targetEmail) {
    console.error('\n❌ Error: Missing email parameter.');
    console.log('\nUsage: node disable_2fa.js <adminEmail|--all> [databaseUrl]\n');
    process.exit(1);
  }

  if (!dbUrl) {
    console.error('\n❌ Error: DATABASE_URL is required (pass as 2nd arg or set DATABASE_URL in .env)\n');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    if (targetEmail === '--all') {
      const res = await pool.query("UPDATE admin_users SET totp_secret = NULL RETURNING email");
      console.log(`\n✅ 2FA disabled for ALL ${res.rows.length} admin accounts.`);
    } else {
      const res = await pool.query(
        "UPDATE admin_users SET totp_secret = NULL WHERE LOWER(email) = LOWER($1) RETURNING email, display_name",
        [targetEmail.toLowerCase().trim()]
      );
      if (res.rows.length === 0) {
        console.log(`\n⚠️ No admin account found matching email: "${targetEmail}"`);
      } else {
        console.log(`\n✅ 2FA (TOTP) successfully disabled for: ${res.rows[0].email} (${res.rows[0].display_name})`);
      }
    }
  } catch (err) {
    console.error('❌ Database error:', err.message);
  } finally {
    await pool.end();
  }
}

disable2FA();
