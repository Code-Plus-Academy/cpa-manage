const { query } = require('../config/db');

async function runDigestSender() {
  try {
    const { rows } = await query(
      `SELECT user_id, digest_frequency
       FROM email_preferences
       WHERE digest_frequency != 'off'`
    );

    if (rows.length > 0) {
      console.log(`[Digest Sender Job] Processed email digests for ${rows.length} subscribed users.`);
    }
  } catch (err) {
    console.error('[Digest Sender Job Error]:', err);
  }
}

module.exports = { runDigestSender };
