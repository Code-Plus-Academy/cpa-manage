/**
 * Configuration loader — validates required environment variables at startup.
 * Exits immediately if any required var is missing (BACKEND_SPEC §7.3).
 */
require('dotenv').config();

const REQUIRED_VARS = [
  'DATABASE_URL',
  'ADMIN_SESSION_SECRET',
];

const OPTIONAL_VARS = {
  NODE_ENV: 'development',
  PORT: '4000',
  GRPC_PORT: '50051',
  MAIN_BACKEND_GRPC_ADDR: 'localhost:50052',
  ADMIN_SESSION_COOKIE_NAME: 'cpa_admin_token',
  ADMIN_COOKIE_DOMAIN: '',
  TOTP_ISSUER_NAME: 'CodePlusAcademy',
  MAIN_BACKEND_URL: 'https://api.codeplusacademy.in',
  EMAIL_PROVIDER_API_KEY: '',
  EMAIL_FROM_ADDRESS: 'notifications@codeplusacademy.in',
  MANAGE_SERVICE_KEY: '',
  WEBHOOK_SERVICE_KEY: '',
};

const missing = REQUIRED_VARS.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`[CONFIG] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[CONFIG] Server cannot start. Check your .env file.');
  process.exit(1);
}

const config = {};
REQUIRED_VARS.forEach(key => { config[key] = process.env[key]; });
Object.entries(OPTIONAL_VARS).forEach(([key, defaultVal]) => {
  config[key] = process.env[key] || defaultVal;
});

// Parse numeric values
config.PORT = parseInt(config.PORT, 10);
config.GRPC_PORT = parseInt(config.GRPC_PORT, 10);

module.exports = config;
