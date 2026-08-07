/**
 * Email Dispatcher Service — cpa-manage backend.
 * Delegates physical email dispatching to CPA Main Backend's smart dual-provider email service.
 */
const https = require('https');
const http = require('http');

async function sendMail({ to, subject, html, from }) {
  const mainBackendUrl = process.env.MAIN_BACKEND_URL || 'https://backend.codeplusacademy.in';
  const serviceKey = process.env.MANAGE_SERVICE_KEY || process.env.INTERNAL_SERVICE_KEY || process.env.CALLBACK_TOKEN || '';

  console.log(`[EmailService] Delegating email dispatch to Main Backend (${mainBackendUrl}/api/internal/send-email) for recipient: ${to}`);

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
            console.log(`[EmailService] SUCCESS: Main Backend accepted and delivered email to ${to}`);
            resolve(true);
          } else {
            console.error(`[EmailService] Main Backend email dispatch failed (HTTP ${res.statusCode}): ${body}`);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error(`[EmailService] Network error calling Main Backend email service at ${mainBackendUrl}:`, err.message || err);
        resolve(false);
      });

      req.write(payload);
      req.end();
    });
  } catch (err) {
    console.error('[EmailService] Exception delegating email to Main Backend:', err.message || err);
    return false;
  }
}

module.exports = { sendMail };
