/**
 * Bootstrap script — creates the first root admin account.
 * Usage: node src/db/seedRootAdmin.js
 * Prompts are hardcoded for now; in production use env vars or CLI args.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { TOTP, Secret } = require('otpauth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  const email = process.env.ROOT_ADMIN_EMAIL || 'root@codeplusacademy.in';
  const password = process.env.ROOT_ADMIN_PASSWORD || 'ChangeMe123!';
  const displayName = process.env.ROOT_ADMIN_NAME || 'Root Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  // Generate TOTP secret
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: process.env.TOTP_ISSUER_NAME || 'CodePlusAcademy',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO admin_users (email, password_hash, display_name, is_root, totp_secret, status)
       VALUES ($1, $2, $3, true, $4, 'active')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email`,
      [email, passwordHash, displayName, secret.base32]
    );

    if (rows.length === 0) {
      console.log(`Root admin already exists: ${email}`);
    } else {
      console.log(`\n=== Root Admin Created ===`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      console.log(`TOTP Secret (base32): ${secret.base32}`);
      console.log(`TOTP URI (for authenticator app): ${totp.toString()}`);
      console.log(`\n⚠️  Save these credentials securely. The password and TOTP secret will not be shown again.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
