/**
 * Email Dispatcher Service — cpa-manage backend.
 * Dispatches real emails via official Resend SDK with automatic fallback and error reporting.
 */
const { Resend } = require('resend');

async function sendMail({ to, subject, html }) {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EmailService] WARN: Neither EMAIL_PROVIDER_API_KEY nor RESEND_API_KEY is set in environment variables on Render. Email dispatch skipped.');
    return false;
  }

  console.log(`[EmailService] Initiating email dispatch to: ${to} (Subject: "${subject}")`);

  const resend = new Resend(apiKey);
  const configuredFrom = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM_AUTH || process.env.EMAIL_FROM_SYSTEM || 'notifications@codeplusacademy.in';
  const fromAddress = configuredFrom.includes('<') ? configuredFrom : `Code+ Academy Admin <${configuredFrom}>`;

  try {
    console.log(`[EmailService] Sending via Resend from: ${fromAddress}`);
    const result = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html,
    });

    if (result.error) {
      console.error('[EmailService] Resend Primary Send Error:', JSON.stringify(result.error));

      // Automatic fallback to Resend testing sender if custom domain is unverified
      if (!fromAddress.includes('onboarding@resend.dev')) {
        console.info('[EmailService] Retrying send via onboarding@resend.dev fallback...');
        const retryResult = await resend.emails.send({
          from: 'Code+ Academy <onboarding@resend.dev>',
          to: [to],
          subject,
          html,
        });

        if (retryResult.error) {
          console.error('[EmailService] Resend Fallback Send Error:', JSON.stringify(retryResult.error));
          return false;
        }

        console.log(`[EmailService] SUCCESS: Email delivered to ${to} via onboarding@resend.dev (Resend ID: ${retryResult.data?.id})`);
        return true;
      }
      return false;
    }

    console.log(`[EmailService] SUCCESS: Email delivered to ${to} (Resend ID: ${result.data?.id})`);
    return true;
  } catch (err) {
    console.error('[EmailService] Exception during Resend dispatch:', err.message || err);
    return false;
  }
}

module.exports = { sendMail };
