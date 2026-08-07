/**
 * Email Dispatcher Service — cpa-manage backend.
 * Dispatches real emails via Resend API or SMTP when configured, and falls back gracefully.
 */
const https = require('https');

async function sendMail({ to, subject, html }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM_AUTH || process.env.EMAIL_FROM_SYSTEM || 'security@codeplusacademy.in';

  if (resendApiKey) {
    try {
      const payload = JSON.stringify({
        from: `Code+ Academy Admin <${fromEmail}>`,
        to: [to],
        subject,
        html,
      });

      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.resend.com',
          port: 443,
          path: '/emails',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`[EmailService] OTP Email sent successfully to ${to} via Resend`);
              resolve(true);
            } else {
              console.warn(`[EmailService] Resend API returned status ${res.statusCode}: ${body}`);
              resolve(false);
            }
          });
        });

        req.on('error', err => {
          console.error(`[EmailService] Failed to send email via Resend:`, err);
          resolve(false);
        });

        req.write(payload);
        req.end();
      });
    } catch (err) {
      console.error('[EmailService] Resend dispatch failed:', err);
      return false;
    }
  } else {
    console.warn(`[EmailService] RESEND_API_KEY not configured in env. OTP email to ${to} was logged to database only.`);
    return false;
  }
}

module.exports = { sendMail };
