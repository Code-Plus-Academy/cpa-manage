/**
 * Email Dispatcher Service — cpa-manage backend.
 * Multi-tier resilient email dispatcher:
 *   Tier 1: Inter-service gRPC to Main Backend
 *   Tier 2: Inter-service HTTP to Main Backend (/api/internal/send-email)
 *   Tier 3: Direct Resend API dispatch via Resend SDK
 */
const grpcClient = require('../grpc/client');
const https = require('https');
const http = require('http');
const { Resend } = require('resend');

async function sendMail({ to, subject, html, from }) {
  console.log(`[EmailService] Initiating email dispatch for recipient: ${to}`);

  // Tier 1: Inter-service gRPC to Main Backend (gRPC First)
  try {
    console.log(`[EmailService] Attempting Tier 1 gRPC dispatch to Main Backend...`);
    const res = await grpcClient.sendEmail({
      to,
      subject,
      html,
      from: from || '',
    });

    if (res && res.success) {
      console.log(`[EmailService] SUCCESS: Main Backend delivered email over gRPC to ${to} (Message ID: ${res.message_id || 'ok'})`);
      return true;
    }
  } catch (grpcErr) {
    console.warn(`[EmailService] Tier 1 gRPC call skipped/failed: ${grpcErr.message || grpcErr} — falling back to Resend API...`);
  }

  // Tier 2: Direct Resend API dispatch from cpa-manage
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY || process.env.RESEND_API_KEY;
  if (apiKey) {
    console.log(`[EmailService] Dispatching email via cpa-manage Resend API fallback...`);
    const directResendOk = await sendMailDirectResend({ to, subject, html, from });
    if (directResendOk) return true;
    console.warn(`[EmailService] Direct Resend API dispatch returned error — falling back to Tier 3 HTTP REST...`);
  }

  // Tier 3: Inter-service HTTP REST fallback to Main Backend
  return sendMailHttpFallback({ to, subject, html, from });
}

async function sendMailHttpFallback({ to, subject, html, from }) {
  const config = require('../config');
  const mainBackendUrl = process.env.MAIN_BACKEND_URL || config.MAIN_BACKEND_URL || 'https://api.codeplusacademy.in';
  if (!mainBackendUrl) {
    console.warn('[EmailService] MAIN_BACKEND_URL not set in environment variables. Tier 2 HTTP fallback skipped.');
    return false;
  }

  const serviceKey = process.env.MANAGE_SERVICE_KEY || process.env.INTERNAL_SERVICE_KEY || process.env.CALLBACK_TOKEN || '';

  try {
    const targetUrl = new URL('/api/internal/send-email', mainBackendUrl);
    const payload = JSON.stringify({ to, subject, html, from });
    const isHttps = targetUrl.protocol === 'https:';
    const clientModule = isHttps ? https : http;

    return new Promise((resolve) => {
      const req = clientModule.request({
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: targetUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': serviceKey ? `Bearer ${serviceKey}` : '',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[EmailService] SUCCESS: Main Backend HTTP endpoint delivered email to ${to}`);
            resolve(true);
          } else {
            console.error(`[EmailService] Main Backend HTTP email dispatch failed (HTTP ${res.statusCode}): ${body}`);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error(`[EmailService] Network error calling Main Backend HTTP email endpoint at ${mainBackendUrl}:`, err.message || err);
        resolve(false);
      });

      req.write(payload);
      req.end();
    });
  } catch (err) {
    console.error('[EmailService] Exception during HTTP email fallback:', err.message || err);
    return false;
  }
}

async function sendMailDirectResend({ to, subject, html, from }) {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[EmailService] FAILED: All dispatch methods failed and neither EMAIL_PROVIDER_API_KEY nor RESEND_API_KEY is configured in cpa-manage env.');
    return false;
  }

  const resend = new Resend(apiKey);
  const configuredFrom = from || process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM_AUTH || 'security@codeplusacademy.in';
  const fromAddress = configuredFrom.includes('<') ? configuredFrom : `Code+ Academy Admin <${configuredFrom}>`;

  try {
    console.log(`[EmailService] Sending directly via Resend API from: ${fromAddress}`);
    const result = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html,
    });

    if (result.error) {
      console.error('[EmailService] Direct Resend primary send error:', JSON.stringify(result.error));

      if (!fromAddress.includes('onboarding@resend.dev')) {
        console.info('[EmailService] Retrying direct Resend via onboarding@resend.dev fallback...');
        const retryResult = await resend.emails.send({
          from: 'Code+ Academy <onboarding@resend.dev>',
          to: [to],
          subject,
          html,
        });

        if (retryResult.error) {
          console.error('[EmailService] Direct Resend fallback error:', JSON.stringify(retryResult.error));
          return false;
        }

        console.log(`[EmailService] SUCCESS: Delivered to ${to} via direct Resend fallback (ID: ${retryResult.data?.id})`);
        return true;
      }
      return false;
    }

    console.log(`[EmailService] SUCCESS: Delivered to ${to} via direct Resend (ID: ${result.data?.id})`);
    return true;
  } catch (err) {
    console.error('[EmailService] Exception during direct Resend dispatch:', err.message || err);
    return false;
  }
}

module.exports = { sendMail };
