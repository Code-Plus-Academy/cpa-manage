/**
 * Email Dispatcher Service — cpa-manage backend.
 * Delegates physical email dispatching over gRPC to CPA Main Backend's smart dual-provider service.
 */
const grpcClient = require('../grpc/client');
const https = require('https');
const http = require('http');

async function sendMail({ to, subject, html, from }) {
  console.log(`[EmailService] Delegating email dispatch over gRPC to Main Backend for recipient: ${to}`);

  try {
    const res = await grpcClient.sendEmail({
      to,
      subject,
      html,
      from: from || '',
    });

    if (res && res.success) {
      console.log(`[EmailService] SUCCESS: Main Backend delivered email over gRPC to ${to} (Message ID: ${res.message_id || 'ok'})`);
      return true;
    } else {
      console.warn(`[EmailService] Main Backend gRPC SendEmail returned error (${res?.error || 'Unknown error'}) — falling back to internal HTTP route...`);
    }
  } catch (grpcErr) {
    console.warn(`[EmailService] gRPC call failed (${grpcErr.message || grpcErr}) — falling back to internal HTTP route...`);
  }

  // Fallback to internal HTTP endpoint if gRPC port is blocked/unreachable
  return sendMailHttpFallback({ to, subject, html, from });
}

async function sendMailHttpFallback({ to, subject, html, from }) {
  const mainBackendUrl = process.env.MAIN_BACKEND_URL || 'https://backend.codeplusacademy.in';
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

module.exports = { sendMail };
