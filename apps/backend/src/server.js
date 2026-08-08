/**
 * Process entrypoint — starts HTTP + gRPC servers.
 */
const config = require('./config');
const app = require('./app');
const { logger } = require('./middleware/requestLogger');

// Start HTTP server
const httpServer = app.listen(config.PORT, () => {
  logger.info(`[cpa-manage-backend] HTTP server running on port ${config.PORT} — ${config.NODE_ENV}`);
});

// Start gRPC server
try {
  const grpcServer = require('./grpc/server');
  grpcServer.start(config.GRPC_PORT);
} catch (err) {
  logger.warn(`[gRPC] Server not started: ${err.message}`);
}

// Start Background Jobs (SLA Checker, Digest Sender, Campaign Sender, Strike Expiry)
const { runSlaChecker } = require('./jobs/slaChecker');
const { runDigestSender } = require('./jobs/digestSender');
const { runCampaignSender } = require('./jobs/campaignSender');
const { runStrikeExpiry } = require('./jobs/strikeExpiry');

setInterval(runSlaChecker, 5 * 60 * 1000);     // Every 5 minutes
setInterval(runCampaignSender, 60 * 1000);     // Every 1 minute
setInterval(runStrikeExpiry, 15 * 60 * 1000);   // Every 15 minutes
setInterval(runDigestSender, 60 * 60 * 1000);   // Every 1 hour

// Auto-run DB Migrations & Seed Default Templates on Startup
const { runMigrations } = require('./db/runMigrations');
const { seedDefaultTemplates } = require('./scripts/seedDefaultTemplates');

(async () => {
  try {
    await runMigrations();
    await seedDefaultTemplates();
    logger.info('[DB] Migrations and default email templates auto-initialized successfully');
  } catch (err) {
    logger.error(`[DB Init Error] ${err.message}`);
  }
})();

logger.info('[cpa-manage-backend] Background jobs initialized successfully');

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
