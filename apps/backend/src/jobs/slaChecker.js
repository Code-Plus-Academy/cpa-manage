const { query } = require('../config/db');

async function runSlaChecker() {
  try {
    const { rows } = await query(
      `SELECT id, category, type, sla_resolve_by, created_at
       FROM support_tickets
       WHERE status = 'open' AND sla_resolve_by < NOW()`
    );

    if (rows.length > 0) {
      console.log(`[SLA Checker Job] Found ${rows.length} tickets breaching SLA resolution deadlines.`);
    }
  } catch (err) {
    console.error('[SLA Checker Job Error]:', err);
  }
}

module.exports = { runSlaChecker };
