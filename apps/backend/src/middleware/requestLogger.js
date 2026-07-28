/**
 * Structured request logging with pino (BACKEND_SPEC §8.1).
 */
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

function requestLogger(req, res, next) {
  const start = Date.now();
  req.log = logger.child({ reqId: req.headers['x-request-id'] || undefined });

  res.on('finish', () => {
    const duration = Date.now() - start;
    req.log.info({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      admin_user_id: req.adminUser?.id || null,
    }, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
}

requestLogger.logger = logger;

module.exports = requestLogger;
