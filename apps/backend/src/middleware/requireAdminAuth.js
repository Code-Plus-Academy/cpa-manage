/**
 * Admin authentication middleware (BACKEND_SPEC §2.1).
 * Validates cpa_admin_token cookie, attaches req.adminUser.
 * Excludes /admin/auth/login and /admin/auth/logout from auth checks.
 */
const crypto = require('crypto');
const { query } = require('../config/db');
const { AppError } = require('../utils/errors');
const config = require('../config');

const COOKIE_NAME = config?.ADMIN_SESSION_COOKIE_NAME || 'cpa_admin_token';

// Paths that don't require authentication
const PUBLIC_PATHS = ['/admin/auth/login', '/admin/auth/logout'];

async function requireAdminAuth(req, res, next) {
  // Skip auth for login/logout
  const fullPath = req.baseUrl + req.path;
  if (PUBLIC_PATHS.some(p => fullPath.startsWith(p))) {
    return next();
  }

  let token = req.cookies?.[COOKIE_NAME];
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token && req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'];
  }

  if (!token) {
    return next(new AppError('UNAUTHENTICATED', 401));
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await query(
      `SELECT
         s.id as session_id,
         a.id, a.email, a.display_name, a.is_root, a.status
       FROM admin_sessions s
       JOIN admin_users a ON a.id = s.admin_user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return next(new AppError('SESSION_EXPIRED', 401));
    }

    const adminUser = rows[0];

    if (adminUser.status !== 'active') {
      return next(new AppError('UNAUTHENTICATED', 401, null, 'This admin account has been disabled.'));
    }

    // Load permissions
    const { rows: permRows } = await query(
      'SELECT permission_key FROM admin_user_permissions WHERE admin_user_id = $1',
      [adminUser.id]
    );

    req.adminUser = {
      id: adminUser.id,
      email: adminUser.email,
      display_name: adminUser.display_name,
      is_root: adminUser.is_root,
      permissions: permRows.map(r => r.permission_key),
      session_id: adminUser.session_id,
    };

    // Update last_active_at (fire-and-forget)
    query('UPDATE admin_sessions SET last_active_at = NOW() WHERE token_hash = $1', [tokenHash]).catch(() => {});

    next();
  } catch (err) {
    return next(new AppError('UNAUTHENTICATED', 401));
  }
}

module.exports = requireAdminAuth;
