/**
 * Email Queue & Worker Service — cpa-manage backend.
 * Powered by BullMQ & ioredis. Decouples sendTemplatedEmail from HTTP request threads.
 * Retries up to 3 times with exponential backoff before recording failure in email_sends.
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { sendTemplatedEmail } = require('./emailTemplateCompiler');

const REDIS_URL = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379';

let redisConnection = null;
let emailQueue = null;
let emailWorker = null;

try {
  redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  redisConnection.on('error', (err) => {
    console.warn('[EmailQueue] Redis Connection Warning:', err.message);
  });

  emailQueue = new Queue('email_dispatch_queue', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  emailWorker = new Worker(
    'email_dispatch_queue',
    async (job) => {
      const { templateKey, recipientEmail, payload, userId } = job.data;
      console.log(`[EmailQueueWorker] Processing email job #${job.id} for ${recipientEmail} (${templateKey})`);
      const sentOk = await sendTemplatedEmail({ templateKey, recipientEmail, payload, userId });
      if (!sentOk) {
        throw new Error(`Email dispatch via Resend failed for ${recipientEmail}`);
      }
      return { recipientEmail, status: 'delivered' };
    },
    { connection: redisConnection }
  );

  emailWorker.on('completed', (job) => {
    console.log(`[EmailQueueWorker] Job #${job.id} completed successfully`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`[EmailQueueWorker] Job #${job?.id} failed (Attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`, err.message);
  });
} catch (err) {
  console.warn('[EmailQueue] BullMQ initialization skipped (Redis unavailable). Falling back to direct sync dispatch.');
}

/**
 * Push email dispatch job to BullMQ queue.
 * Falls back to direct async sendTemplatedEmail if Redis is unavailable.
 */
async function queueEmailDispatch({ templateKey, recipientEmail, payload = {}, userId = null }) {
  if (emailQueue && redisConnection && redisConnection.status === 'ready') {
    try {
      const job = await emailQueue.add('send_templated_email', {
        templateKey,
        recipientEmail,
        payload,
        userId,
      });
      console.log(`[EmailQueue] Queued email job #${job.id} for ${recipientEmail}`);
      return true;
    } catch (err) {
      console.warn('[EmailQueue] Queue push failed, falling back to direct send:', err.message);
    }
  }

  // Fallback to direct async send
  return sendTemplatedEmail({ templateKey, recipientEmail, payload, userId });
}

module.exports = {
  queueEmailDispatch,
  emailQueue,
  emailWorker,
};
