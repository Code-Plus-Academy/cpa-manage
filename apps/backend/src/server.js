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

// Start gRPC server (Phase 0 stub — full implementation in later phases)
try {
  const grpcServer = require('./grpc/server');
  grpcServer.start(config.GRPC_PORT);
} catch (err) {
  logger.warn(`[gRPC] Server not started: ${err.message}`);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
