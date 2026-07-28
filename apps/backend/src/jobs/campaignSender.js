const { query } = require('../config/db');

async function runCampaignSender() {
  try {
    const { rows } = await query(
      `SELECT id, template_key, segment_filter
       FROM email_campaigns
       WHERE status = 'scheduled' AND (scheduled_at IS NULL OR scheduled_at <= NOW())`
    );

    for (const campaign of rows) {
      await query(
        `UPDATE email_campaigns SET status = 'sending' WHERE id = $1`,
        [campaign.id]
      );
      console.log(`[Campaign Sender Job] Dispatched scheduled email campaign ${campaign.id}`);
      await query(
        `UPDATE email_campaigns SET status = 'sent' WHERE id = $1`,
        [campaign.id]
      );
    }
  } catch (err) {
    console.error('[Campaign Sender Job Error]:', err);
  }
}

module.exports = { runCampaignSender };
