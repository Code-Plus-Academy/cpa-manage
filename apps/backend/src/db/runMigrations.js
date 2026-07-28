/**
 * Migration runner — executes SQL migration files in order.
 * Usage: node src/db/runMigrations.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const { rows: applied } = await client.query('SELECT name FROM _migrations');
    const appliedSet = new Set(applied.map(r => r.name));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  [SKIP] ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`  [RUN]  ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  [OK]   ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  [FAIL] ${file}:`, err.message);
        process.exit(1);
      }
    }

    console.log('\nAll migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
