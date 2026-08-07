const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const { query } = require('../config/db');
const { AppError } = require('../utils/errors');
const config = require('../config');

const COOKIE_NAME = config.ADMIN_SESSION_COOKIE_NAME || 'cpa_admin_token';
const SESSION_MAX_AGE_DAYS = 30;

/**
 * Helper to fetch permissions for an admin user.
 */
async function getPermissionsForAdmin(adminId) {
  const { rows } = await query(
    'SELECT permission_key FROM admin_user_permissions WHERE admin_user_id = $1',
    [adminId]
  );
  return rows.map(r => r.permission_key);
}

// ─── POST /admin/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, totp_code } = req.body;

    if (!email || !password) {
      return next(new AppError('VALIDATION_ERROR', 400, {
        fields: {
          email: !email ? 'required' : undefined,
          password: !password ? 'required' : undefined,
        }
      }));
    }

    // Fetch admin user (case-insensitive email search)
    const { rows } = await query(
      'SELECT id, email, password_hash, display_name, is_root, status, totp_secret FROM admin_users WHERE LOWER(email) = LOWER($1)',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return next(new AppError('INVALID_CREDENTIALS', 401, null, 'Invalid email or password.'));
    }

    const admin = rows[0];

    if (admin.status !== 'active') {
      return next(new AppError('UNAUTHENTICATED', 401, null, 'This admin account has been disabled.'));
    }

    // Verify password hash (supports bcrypt $2a$, $2b$, $2y$, etc., or SHA-256 hex)
    let passwordMatches = false;
    if (admin.password_hash.startsWith('$2')) {
      try {
        const bcrypt = require('bcryptjs');
        passwordMatches = await bcrypt.compare(password, admin.password_hash);
      } catch (e) {
        passwordMatches = false;
      }
    } else {
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      passwordMatches = (hash === admin.password_hash);
      if (!passwordMatches) {
        // Fallback check with bcrypt in case hash format is ambiguous
        try {
          const bcrypt = require('bcryptjs');
          passwordMatches = await bcrypt.compare(password, admin.password_hash);
        } catch (e) {}
      }
    }

    if (!passwordMatches) {
      return next(new AppError('INVALID_CREDENTIALS', 401, null, 'Invalid email or password.'));
    }

    // Check 2FA if enabled
    if (admin.totp_secret && admin.totp_secret.trim() !== '') {
      if (!totp_code) {
        return next(new AppError('TOTP_REQUIRED', 401, null, '2FA code required for login.'));
      }
      const verified = speakeasy.totp.verify({
        secret: admin.totp_secret.trim(),
        encoding: 'base32',
        token: totp_code.trim(),
        window: 2,
      });
      if (!verified) {
        return next(new AppError('TOTP_INVALID', 401, null, 'Invalid or expired 2FA code.'));
      }
    }

    // Create session with device/IP tracking & session_family_id
    let deviceInfo = 'Unknown Device';
    try {
      const UAParser = require('ua-parser-js');
      const parser = new UAParser(req.headers['user-agent']);
      const browser = parser.getBrowser();
      const os = parser.getOS();
      deviceInfo = `${browser.name || 'Unknown Browser'} on ${os.name || 'Unknown OS'}`;
    } catch (e) {
      deviceInfo = (req.headers['user-agent'] || 'Unknown Device').slice(0, 150);
    }
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'Unknown IP';
    const location = 'Unknown Location';

    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

    const { rows: sessionRows } = await query(
      `INSERT INTO admin_sessions (admin_user_id, token_hash, device_info, ip_address, location, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [admin.id, tokenHash, deviceInfo, ipAddress, location, expiresAt]
    );

    const sessionId = sessionRows[0].id;
    await query('UPDATE admin_sessions SET session_family_id = $1 WHERE id = $1', [sessionId]);

    // Update last_login_at
    await query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [admin.id]);

    // Load permissions
    const permissions = await getPermissionsForAdmin(admin.id);

    // Set HTTP-only host-isolated cookie (locked exclusively to manage.codeplusacademy.in)
    const isProd = config.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      domain: process.env.ADMIN_COOKIE_DOMAIN || undefined, // undefined = host-only cookie locked to manage domain
      maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      token: rawToken,
      admin_user: {
        id: admin.id,
        email: admin.email,
        display_name: admin.display_name,
        is_root: admin.is_root,
        permissions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/auth/me ────────────────────────────────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    let token = req.cookies?.[COOKIE_NAME];
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }
    if (!token && req.headers['x-admin-token']) {
      token = req.headers['x-admin-token'];
    }

    if (!token) {
      return next(new AppError('SESSION_EXPIRED', 401));
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await query(
      `SELECT a.id, a.email, a.display_name, a.is_root, a.status
       FROM admin_sessions s
       JOIN admin_users a ON a.id = s.admin_user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash]
    );

    if (rows.length === 0 || rows[0].status !== 'active') {
      return next(new AppError('SESSION_EXPIRED', 401));
    }

    const admin = rows[0];
    const permissions = await getPermissionsForAdmin(admin.id);

    res.json({
      admin_user: {
        id: admin.id,
        email: admin.email,
        display_name: admin.display_name,
        is_root: admin.is_root,
        permissions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/auth/logout ───────────────────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await query('DELETE FROM admin_sessions WHERE token_hash = $1', [tokenHash]);
    }

    const isProd = config.NODE_ENV === 'production';
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      domain: process.env.ADMIN_COOKIE_DOMAIN || undefined,
      path: '/',
    });

    res.json({});
  } catch (err) {
    next(err);
  }
});

// POST /admin/auth/verify-worker-otp — Complete worker admin registration with 6-digit OTP
router.post('/verify-worker-otp', async (req, res, next) => {
  try {
    const { email, otp_code, set_password } = req.body;

    if (!email || !otp_code) {
      return next(new AppError('VALIDATION_ERROR', 400, { fields: { email: !email ? 'required' : undefined, otp_code: !otp_code ? 'required' : undefined } }));
    }

    const { rows } = await query(
      `SELECT id, email, display_name, is_root, status, registration_otp, registration_otp_expires_at
       FROM admin_users WHERE LOWER(email) = LOWER($1)`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return next(new AppError('NOT_FOUND', 404, null, 'Admin user not found.'));
    }

    const admin = rows[0];

    if (admin.registration_otp !== otp_code.trim()) {
      return next(new AppError('INVALID_OTP', 400, null, 'Invalid registration OTP code.'));
    }

    if (new Date(admin.registration_otp_expires_at) < new Date()) {
      return next(new AppError('EXPIRED_OTP', 400, null, 'Registration OTP has expired. Please ask Superadmin to resend.'));
    }

    let passwordHashUpdate = '';
    let values = ['active', admin.id];
    if (set_password) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(set_password, 12);
      passwordHashUpdate = ', password_hash = $3';
      values.push(hash);
    }

    await query(
      `UPDATE admin_users
       SET status = $1, registration_otp = NULL, registration_otp_expires_at = NULL ${passwordHashUpdate}
       WHERE id = $2`,
      values
    );

    res.json({ message: 'Worker admin registration verified and account activated successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
