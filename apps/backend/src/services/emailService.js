/**
 * Email Dispatcher Service — cpa-manage backend.
 * Dispatches real emails via official Resend SDK with automatic fallback and error reporting.
 */
const { Resend } = require('resend');

async function sendMail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EmailService] RESEND_API_KEY missing in environment variables on Render. Email not dispatched to network.');
    return false;
  }

  const resend = new Resend(apiKey);
  const configuredFrom = process.env.EMAIL_FROM_AUTH || process.env.EMAIL_FROM_SYSTEM || 'security@codeplusacademy.in';
  const fromAddress = configuredFrom.includes('<') ? configuredFrom : `Code+ Academy Admin <${configuredFrom}>`;

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html,
    });

    if (result.error) {
      console.error('[EmailService] Primary Resend send failed:', result.error);

      // Automatic fallback to Resend testing sender if custom domain is unverified
      if (!fromAddress.includes('onboarding@resend.dev')) {
        console.info('[EmailService] Retrying send via onboarding@resend.dev...');
        const retryResult = await resend.emails.send({
          from: 'Code+ Academy <onboarding@resend.dev>',
          to: [to],
          subject,
          html,
        });

        if (retryResult.error) {
          console.error('[EmailService] Fallback Resend send failed:', retryResult.error);
          return false;
        }

        console.log(`[EmailService] OTP email delivered to ${to} via Resend (ID: ${retryResult.data?.id})`);
        return true;
      }
      return false;
    }

    console.log(`[EmailService] OTP email delivered to ${to} via Resend (ID: ${result.data?.id})`);
    return true;
  } catch (err) {
    console.error('[EmailService] Exception during Resend dispatch:', err.message || err);
    return false;
  }
}

module.exports = { sendMail };
