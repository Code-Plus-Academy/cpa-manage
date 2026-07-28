/**
 * AppError class and standard error codes (BACKEND_SPEC §3.2-3.3).
 */

const DEFAULT_MESSAGES = {
  VALIDATION_ERROR: 'Invalid input provided.',
  UNAUTHENTICATED: 'Authentication is required.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  TOTP_REQUIRED: 'TOTP verification code is required for this account.',
  TOTP_INVALID: 'The TOTP code provided is invalid or expired.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  FORBIDDEN: 'You are not allowed to perform this action.',
  PERMISSION_DENIED: "You don't have permission to perform this action.",
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'This action conflicts with existing data.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  INTERNAL_ERROR: 'Something went wrong.',
  UPSTREAM_UNAVAILABLE: 'An upstream service is temporarily unavailable.',
};

class AppError extends Error {
  constructor(code, statusCode, details = null, message = null) {
    super(message || DEFAULT_MESSAGES[code] || 'An error occurred');
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

// Factory helpers
const validationError = (fields) => new AppError('VALIDATION_ERROR', 400, { fields });
const notFound = (resource) => new AppError('NOT_FOUND', 404, { resource });
const conflict = (reason) => new AppError('CONFLICT', 409, null, reason);
const permissionDenied = (required) => new AppError('PERMISSION_DENIED', 403, { required });
const upstreamUnavailable = (details) => new AppError('UPSTREAM_UNAVAILABLE', 502, details);

module.exports = {
  AppError,
  DEFAULT_MESSAGES,
  validationError,
  notFound,
  conflict,
  permissionDenied,
  upstreamUnavailable,
};
