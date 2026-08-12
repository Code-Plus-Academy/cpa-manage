/**
 * Inbound Email Queue & Worker Service — cpa-manage backend.
 * Powered by BullMQ & ioredis. Asynchronously processes inbound Resend webhooks,
 * fetches full email body, parses reply text, performs thread matching via GIN index,
 * and updates/creates support tickets.
 */
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const EmailReplyParser = require('node-email-reply-parser');
const { query, getClient } = require('../config/db');

const REDIS_URL = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379';

let redisConnection = null;
let inboundQueue = null;
let inboundWorker = null;

const MAILBOX_MAP = {
  'support@codeplusacademy.in': 'support',
  'careers@codeplusacademy.in': 'careers',
  'safety@codeplusacademy.in': 'safety',
  'security@codeplusacademy.in': 'safety',
  'billing@codeplusacademy.in': 'support',
};

function extractMailbox(toAddresses = []) {
  if (!Array.isArray(toAddresses)) return 'support';
  for (const addr of toAddresses) {
    if (!addr) continue;
    const normalized = String(addr).toLowerCase().replace(/.*<|>.*/g, '').trim();
    if (MAILBOX_MAP[normalized]) return MAILBOX_MAP[normalized];
    if (normalized.includes('careers')) return 'careers';
    if (normalized.includes('safety') || normalized.includes('security')) return 'safety';
  }
  return 'support';
}

function autoCategorize(subject = '', body = '') {
  const combined = `${subject} ${body}`.toLowerCase();
  if (/bill|payment|charge|refund|invoice|subscription|plan/i.test(combined)) {
    return 'Billing';
  }
  if (/bug|error|crash|fail|broken|issue|issue|exception|stack/i.test(combined)) {
    return 'Bug Report';
  }
  if (/login|password|auth|otp|2fa|access|account|permission/i.test(combined)) {
    return 'Technical Support';
  }
  if (/feature|request|add|suggest|improve|enhancement/i.test(combined)) {
    return 'Feature Request';
  }
  return 'General Inquiry';
}

async function processInboundEmailJob(jobData) {
  const { resendEmailId, rawPayload } = jobData;
  console.log(`[InboundEmailWorker] Processing inbound email job for Resend ID: ${resendEmailId}`);

  // Idempotency check: prevent duplicate processing
  const { rows: existingMsg } = await query(
    'SELECT id FROM support_email_messages WHERE resend_email_id = $1',
    [resendEmailId]
  );
  if (existingMsg.length > 0) {
    console.log(`[InboundEmailWorker] Email ${resendEmailId} already processed — skipping.`);
    return { status: 'duplicate_skipped' };
  }

  // Fetch full email content from Resend API if payload incomplete
  const config = require('../config');
  const apiKey =
    process.env.EMAIL_PROVIDER_API_KEY ||
    process.env.RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    process.env.RESEND_API_TOKEN ||
    process.env.RESEND_TOKEN ||
    process.env.RESEND_SECRET ||
    config.EMAIL_PROVIDER_API_KEY ||
    config.RESEND_API_KEY;

  let emailData = rawPayload;

  if (!emailData?.html && !emailData?.text && apiKey) {
    console.log(`[InboundEmailWorker] Fetching full email body from Resend API for ID: ${resendEmailId}...`);
    const endpointsToTry = [
      `https://api.resend.com/emails/receiving/${resendEmailId}`,
      `https://api.resend.com/emails/inbound/${resendEmailId}`,
      `https://api.resend.com/emails/received/${resendEmailId}`,
      `https://api.resend.com/emails/${resendEmailId}`,
    ];

    for (const endpoint of endpointsToTry) {
      try {
        const fetchResp = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (fetchResp.ok) {
          emailData = await fetchResp.json();
          console.log(`[InboundEmailWorker] Successfully fetched email content from ${endpoint}`);
          break;
        } else {
          console.warn(`[InboundEmailWorker] Resend endpoint ${endpoint} returned HTTP ${fetchResp.status}`);
        }
      } catch (fetchErr) {
        console.warn(`[InboundEmailWorker] Fetch error for ${endpoint}:`, fetchErr.message);
      }
    }
  } else if (!emailData?.html && !emailData?.text) {
    console.warn(`[InboundEmailWorker] Warning: No Resend API Key found in environment (RESEND_API_KEY / EMAIL_PROVIDER_API_KEY / RESEND_KEY / RESEND_TOKEN). Unable to fetch email body for ${resendEmailId}.`);
  }

  const fromAddress = emailData?.from || emailData?.headers?.from || 'unknown@customer.com';
  const toAddresses = Array.isArray(emailData?.to) ? emailData.to : [emailData?.to || 'support@codeplusacademy.in'];
  const subject = emailData?.subject || 'Inbound Support Request';

  // Resend inbound webhooks can deliver body in multiple shapes — try all of them
  const rawBodyText =
    emailData?.text ||
    emailData?.body_text ||
    emailData?.body ||
    emailData?.payload?.text ||
    emailData?.content ||
    emailData?.data?.text ||
    emailData?.data?.body_text ||
    '';
  const rawBodyHtml =
    emailData?.html ||
    emailData?.body_html ||
    emailData?.payload?.html ||
    emailData?.data?.html ||
    emailData?.data?.body_html ||
    (rawBodyText ? `<p>${rawBodyText.replace(/\n/g, '<br/>')}</p>` : `<p>${subject}</p>`);
  
  // Parse reply text to extract clean message without trailing reply history
  let cleanText = rawBodyText || subject;
  try {
    if (rawBodyText) {
      // 1. Try node-email-reply-parser
      const parsed = new EmailReplyParser().read(rawBodyText);
      let parsedText = parsed.getVisibleText();
      
      // 2. Multilingual reply header stripper (Arabic, French, Spanish, German, English)
      if (parsedText) {
        const quoteRegex = /(?:\r?\n)(?:في\s+.*كتب:|On\s+.*wrote:|Le\s+.*écrit:|El\s+.*escribió:|Am\s+.*schrieb:|>|-{3,}Original Message-{3,})/i;
        const match = parsedText.search(quoteRegex);
        if (match > 0) {
          parsedText = parsedText.substring(0, match).trim();
        }
      }
      
      cleanText = parsedText || rawBodyText || subject;
    }
  } catch (e) {
    cleanText = rawBodyText || subject;
  }

  // Internet Message ID & Thread References
  const internetMsgId = emailData?.headers?.['message-id'] || `<${resendEmailId}@resend.dev>`;
  const inReplyTo = emailData?.headers?.['in-reply-to'] || null;
  const rawReferences = emailData?.headers?.['references'] || '';
  const referencesArray = rawReferences
    ? rawReferences.split(/\s+/).filter(Boolean)
    : (inReplyTo ? [inReplyTo] : []);

  const targetMailbox = extractMailbox(toAddresses);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Thread Lookup Strategy:
    // 1. Primary: GIN index match on references_message_ids matching inReplyTo or referencesArray
    // 2. Fallback: match by reporter_email + target_mailbox + status != 'resolved'
    let matchedTicket = null;

    if (inReplyTo || referencesArray.length > 0) {
      const lookupIds = Array.from(new Set([inReplyTo, ...referencesArray].filter(Boolean)));
      const { rows: threadMatches } = await client.query(
        `SELECT id, references_message_ids, reporter_email
         FROM support_tickets
         WHERE references_message_ids && $1::text[]
         ORDER BY last_message_at DESC
         LIMIT 1`,
        [lookupIds]
      );
      if (threadMatches.length > 0) {
        matchedTicket = threadMatches[0];
      }
    }

    if (!matchedTicket) {
      const cleanReporterEmail = fromAddress.replace(/.*<|>.*/g, '').trim().toLowerCase();
      const { rows: fallbackMatches } = await client.query(
        `SELECT id, references_message_ids, reporter_email
         FROM support_tickets
         WHERE LOWER(TRIM(reporter_email)) = $1 AND target_mailbox = $2 AND status != 'resolved'
         ORDER BY created_at DESC
         LIMIT 1`,
        [cleanReporterEmail, targetMailbox]
      );
      if (fallbackMatches.length > 0) {
        matchedTicket = fallbackMatches[0];
      }
    }

    let ticketId;

    if (matchedTicket) {
      ticketId = matchedTicket.id;
      // Append internetMsgId to references_message_ids array if not present
      const updatedRefs = Array.from(new Set([...(matchedTicket.references_message_ids || []), internetMsgId]));

      await client.query(
        `UPDATE support_tickets
         SET references_message_ids = $1,
             last_message_at = NOW(),
             status = 'open',
             updated_at = NOW()
         WHERE id = $2`,
        [updatedRefs, ticketId]
      );
      console.log(`[InboundEmailWorker] Appended message to existing ticket #${ticketId}`);
    } else {
      // Create new ticket
      const cleanReporterEmail = fromAddress.replace(/.*<|>.*/g, '').trim().toLowerCase();
      const category = autoCategorize(subject, cleanText);
      const slaResolveBy = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

      const { rows: newTicketRows } = await client.query(
        `INSERT INTO support_tickets (
          reporter_email, type, case_source, category, description,
          target_mailbox, references_message_ids, status, sla_resolve_by, last_message_at
        ) VALUES ($1, 'email_inbound', 'email', $2, $3, $4, $5, 'open', $6, NOW())
        RETURNING id`,
        [cleanReporterEmail, category, cleanText || subject, targetMailbox, [internetMsgId], slaResolveBy]
      );

      ticketId = newTicketRows[0].id;
      console.log(`[InboundEmailWorker] Created new support ticket #${ticketId} (Mailbox: ${targetMailbox}, Category: ${category})`);
    }

    // Save message into support_email_messages
    await client.query(
      `INSERT INTO support_email_messages (
        ticket_id, resend_email_id, internet_message_id, direction,
        from_address, to_address, subject, body_html, body_text
      ) VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7, $8)`,
      [
        ticketId,
        resendEmailId,
        internetMsgId,
        fromAddress,
        toAddresses,
        subject,
        rawBodyHtml,
        cleanText,
      ]
    );

    await client.query('COMMIT');
    return { ticketId, resendEmailId, status: matchedTicket ? 'appended' : 'created' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

try {
  redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  redisConnection.on('error', (err) => {
    console.warn('[InboundEmailQueue] Redis Connection Warning:', err.message);
  });

  inboundQueue = new Queue('inbound_email_queue', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  inboundWorker = new Worker(
    'inbound_email_queue',
    async (job) => {
      return await processInboundEmailJob(job.data);
    },
    { connection: redisConnection }
  );

  inboundWorker.on('completed', (job, result) => {
    console.log(`[InboundEmailWorker] Job #${job.id} completed: Ticket #${result.ticketId} (${result.status})`);
  });

  inboundWorker.on('failed', (job, err) => {
    console.error(`[InboundEmailWorker] Job #${job?.id} failed:`, err.message);
  });
} catch (err) {
  console.warn('[InboundEmailQueue] Redis unavailable — queue fallback active.');
}

async function enqueueInboundEmailJob({ resendEmailId, rawPayload }) {
  if (inboundQueue && redisConnection && redisConnection.status === 'ready') {
    try {
      const job = await inboundQueue.add('process_inbound_email', { resendEmailId, rawPayload });
      console.log(`[InboundEmailQueue] Enqueued job #${job.id} for Resend ID ${resendEmailId}`);
      return job;
    } catch (err) {
      console.warn('[InboundEmailQueue] Queue add failed, falling back to sync process:', err.message);
    }
  }

  // Fallback to synchronous process if Redis offline
  return await processInboundEmailJob({ resendEmailId, rawPayload });
}

module.exports = {
  enqueueInboundEmailJob,
  processInboundEmailJob,
  inboundQueue,
  inboundWorker,
};
