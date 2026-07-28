/**
 * Final error-to-JSON middleware (BACKEND_SPEC §3.4).
 * Must be the LAST middleware mounted in app.js.
 */
const { AppError } = require('../utils/errors');

function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      req.log?.error(err, 'Operational server error');
    }
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || undefined,
      },
    });
  }

  // Unexpected error — never leak internals
  req.log?.error(err, 'Unexpected error');
  console.error('[UNEXPECTED ERROR]', err.stack || err.message);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong.',
    },
  });
}

module.exports = errorHandler;
