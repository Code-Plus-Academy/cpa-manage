/**
 * PostgreSQL connection pool for the Social DB.
 */
const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[Social DB] Unexpected pool error:', err.message);
});

const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error(`[DB QUERY ERROR] ${text.substring(0, 80)}...`, err.message);
    throw err;
  }
};

const getClient = async () => {
  return await pool.connect();
};

module.exports = { pool, query, getClient };
