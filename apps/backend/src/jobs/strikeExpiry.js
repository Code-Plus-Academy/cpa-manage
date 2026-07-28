const { query } = require('../config/db');

async function runStrikeExpiry() {
  try {
    const result = await query(
      `UPDATE strikes
       SET is_active = false
       WHERE is_active = true AND expires_at < NOW()`
    );

    if (result.rowCount > 0) {
      console.log(`[Strike Expiry Job] Automatically expired ${result.rowCount} strikes exceeding 90 days.`);
    }
  } catch (err) {
    console.error('[Strike Expiry Job Error]:', err);
  }
}

module.exports = { runStrikeExpiry };
