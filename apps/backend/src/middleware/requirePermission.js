/**
 * Permission middleware factory (BACKEND_SPEC §2.2).
 *
 * Usage:
 *   router.get('/cases', requirePermission('support.view'), handler)
 *   router.get('/cases', requirePermission.any(['support.view', 'claims.copyright.view']), handler)
 *   router.post('/admins', requirePermission.rootOnly, handler)
 */
const { AppError } = require('../utils/errors');

function requirePermission(key) {
  return (req, res, next) => {
    if (!req.adminUser) {
      return next(new AppError('UNAUTHENTICATED', 401));
    }
    // Root bypasses all permission checks
    if (req.adminUser.is_root) return next();
    if (req.adminUser.permissions.includes(key)) return next();
    return next(new AppError('PERMISSION_DENIED', 403, { required: key }));
  };
}

requirePermission.any = (keys) => {
  return (req, res, next) => {
    if (!req.adminUser) {
      return next(new AppError('UNAUTHENTICATED', 401));
    }
    if (req.adminUser.is_root) return next();
    if (keys.some(k => req.adminUser.permissions.includes(k))) return next();
    return next(new AppError('PERMISSION_DENIED', 403, { required: keys }));
  };
};

requirePermission.rootOnly = (req, res, next) => {
  if (!req.adminUser) {
    return next(new AppError('UNAUTHENTICATED', 401));
  }
  if (req.adminUser.is_root) return next();
  return next(new AppError('PERMISSION_DENIED', 403, { required: 'admin.manage (root only)' }));
};

module.exports = requirePermission;
