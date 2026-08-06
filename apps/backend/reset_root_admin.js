/**
 * reset_root_admin.js — CPA Manage Root Admin Password Resetter
 *
 * Usage:
 *   node reset_root_admin.js <newPassword> [adminEmail] [databaseUrl]
 *
 * Example:
 *   node reset_root_admin.js "MySecretPass123!" "admin@codeplusacademy.in" "postgresql://..."
 */

const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

async function resetPassword() {
  const newPassword = process.argv[2];
  const targetEmail = (process.argv[3] || 'admin@codeplusacademy.in').toLowerCase().trim();
  const dbUrl = process.argv[4] || process.env.DATABASE_URL;

  if (!newPassword) {
    console.error('\n❌ Error: Missing new password argument.');
    console.log('\nUsage: node reset_root_admin.js <newPassword> [adminEmail] [databaseUrl]\n');
    process.exit(1);
  }

  if (!dbUrl) {
    console.error('\n❌ Error: DATABASE_URL environment variable or argument is missing.');
    console.log('\nPlease provide databaseUrl as 3rd CLI param or set DATABASE_URL in .env\n');
    process.exit(1);
  }

  console.log(`\n🔐 Resetting password for admin: ${targetEmail}...`);

  // Generate SHA-256 hash (supported natively by auth.js)
  const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    // Check if target user exists
    const checkRes = await pool.query(
      'SELECT id, email, display_name, is_root FROM admin_users WHERE email = $1 OR is_root = true LIMIT 1',
      [targetEmail]
    );

    if (checkRes.rows.length === 0) {
      console.log(`ℹ️ Admin account not found. Creating new root admin (${targetEmail})...`);
      const insertRes = await pool.query(
        `INSERT INTO admin_users (email, password_hash, display_name, is_root, status)
         VALUES ($1, $2, 'Root Admin', true, 'active')
         RETURNING id, email, is_root`,
        [targetEmail, passwordHash]
      );
      console.log(`✅ Root admin created successfully!`);
      console.log(`   ID: ${insertRes.rows[0].id}`);
      console.log(`   Email: ${insertRes.rows[0].email}`);
    } else {
      const admin = checkRes.rows[0];
      console.log(`Found existing admin account [ID: ${admin.id}, Email: ${admin.email}]`);
      const updateRes = await pool.query(
        `UPDATE admin_users
         SET password_hash = $1, status = 'active', is_root = true, totp_secret = NULL
         WHERE id = $2
         RETURNING id, email, is_root`,
        [passwordHash, admin.id]
      );
      console.log(`✅ Root admin password updated and 2FA reset successfully!`);
      console.log(`   ID: ${updateRes.rows[0].id}`);
      console.log(`   Email: ${updateRes.rows[0].email}`);
    }

    console.log(`\n🎉 Root admin password successfully reset to: "${newPassword}"\n`);
  } catch (err) {
    console.error('❌ Database error:', err.message);
  } finally {
    await pool.end();
  }
}

resetPassword();
