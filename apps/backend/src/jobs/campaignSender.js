const { query } = require('../config/db');

async function runCampaignSender() {
  try {
    const { rows } = await query(
      `SELECT id, template_key, segment_filter
       FROM email_campaigns
       WHERE status = 'scheduled' AND (scheduled_at IS NULL OR scheduled_at <= NOW())`
    );

    for (const campaign of rows) {
      console.warn(
        `[Campaign Sender Job] Skipping campaign ${campaign.id}: Bulk dispatch engine for segment filters (${typeof campaign.segment_filter === 'object' ? JSON.stringify(campaign.segment_filter) : campaign.segment_filter}) is not yet implemented. Campaign status remains 'scheduled'.`
      );
      // STUB SAFETY: Do NOT update campaign status to 'sent' without dispatching emails.
    }
  } catch (err) {
    console.error('[Campaign Sender Job Error]:', err);
  }
}

module.exports = { runCampaignSender };
