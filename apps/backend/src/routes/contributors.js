/**
 * Admin Contributors Management Router — cpa-manage-backend.
 * Allows managing platform contributors displayed on /contributors.
 */
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/db');
const { AppError } = require('../utils/errors');
const requirePermission = require('../middleware/requirePermission');
const { writeAuditLog } = require('../middleware/auditLog');

/**
 * GET /admin/contributors
 * List all users with posts_count, is_featured, role_title, and badge.
 */
router.get('/', async (req, res, next) => {
  try {
    // Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS featured_contributors (
        id SERIAL PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        role_title TEXT,
        badge TEXT,
        featured_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const q = req.query.q ? `%${req.query.q.trim()}%` : null;

    let rows = [];
    try {
      let queryText = `
        SELECT
          u.id, u.username, u.name, u.email, u.avatar_url,
          u.account_type, u.created_at,
          COALESCE(
            (SELECT institution FROM user_education WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1),
            u.location,
            'Autonomous Tech Institute'
          ) AS college_name,
          fc.role_title, fc.badge, fc.featured_at,
          (fc.user_id IS NOT NULL) AS is_featured,
          COALESCE((SELECT COUNT(*) FROM posts WHERE creator_id = u.id), 0)::int AS posts_count
        FROM users u
        LEFT JOIN featured_contributors fc ON fc.user_id = u.id
      `;

      const params = [];
      if (q) {
        params.push(q);
        queryText += ` WHERE (u.name ILIKE $1 OR u.username ILIKE $1 OR u.email ILIKE $1 OR u.bio ILIKE $1)`;
      }

      queryText += ` ORDER BY is_featured DESC, fc.featured_at DESC NULLS LAST, u.created_at DESC LIMIT 250`;

      const result = await query(queryText, params);
      rows = result.rows;
    } catch (innerErr) {
      console.warn('[Contributors GET / fallback query]', innerErr.message);
      // Resilient fallback query with only core users columns
      let fallbackQuery = `
        SELECT
          u.id, u.username, u.name, u.email, u.avatar_url,
          u.account_type, u.created_at,
          fc.role_title, fc.badge, fc.featured_at,
          (fc.user_id IS NOT NULL) AS is_featured,
          0::int AS posts_count,
          'Autonomous Tech Institute' AS college_name
        FROM users u
        LEFT JOIN featured_contributors fc ON fc.user_id = u.id
      `;
      const params = [];
      if (q) {
        params.push(q);
        fallbackQuery += ` WHERE (u.name ILIKE $1 OR u.username ILIKE $1 OR u.email ILIKE $1)`;
      }
      fallbackQuery += ` ORDER BY is_featured DESC, fc.featured_at DESC NULLS LAST, u.created_at DESC LIMIT 250`;
      const result = await query(fallbackQuery, params);
      rows = result.rows;
    }

    res.json({ contributors: rows, users: rows });
  } catch (err) {
    console.error('[GET /admin/contributors]', err);
    res.status(200).json({ contributors: [], users: [], error: err.message });
  }
});

/**
 * POST /admin/contributors/feature
 * Body: { user_id, username, role_title, badge }
 */
router.post('/feature', async (req, res, next) => {
  const client = await getClient();
  try {
    let { user_id, username, role_title, badge } = req.body;

    if (!user_id && username) {
      const cleanUsername = username.replace(/^@/, '').trim();
      const userRes = await client.query('SELECT id FROM users WHERE username ILIKE $1 LIMIT 1', [cleanUsername]);
      if (userRes.rows.length > 0) {
        user_id = userRes.rows[0].id;
      } else {
        return next(new AppError('NOT_FOUND', 404, { message: `User with username @${cleanUsername} not found.` }));
      }
    }

    if (!user_id) {
      return next(new AppError('VALIDATION_ERROR', 400, { fields: { user_id: 'required' } }));
    }

    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS featured_contributors (
        id SERIAL PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        role_title TEXT,
        badge TEXT,
        featured_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await client.query(`
      INSERT INTO featured_contributors (user_id, role_title, badge, featured_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET role_title = EXCLUDED.role_title,
            badge = EXCLUDED.badge,
            featured_at = NOW()
      RETURNING *
    `, [user_id, role_title || null, badge || null]);

    if (req.adminUser) {
      await writeAuditLog(client, {
        actorAdminId: req.adminUser.id,
        actorIsRoot: req.adminUser.is_root,
        permissionUsed: 'users.moderate',
        module: 'community',
        action: 'contributors.featured',
        targetType: 'user',
        targetId: String(user_id),
        reason: `Featured as contributor with badge: ${badge || 'Verified'}`,
        metadata: { role_title, badge },
      });
    }

    await client.query('COMMIT');

    res.status(200).json({ success: true, featured: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * DELETE /admin/contributors/feature/:userId
 */
router.delete('/feature/:userId', async (req, res, next) => {
  const client = await getClient();
  try {
    const { userId } = req.params;

    await client.query('BEGIN');

    await client.query('DELETE FROM featured_contributors WHERE user_id = $1', [userId]);

    if (req.adminUser) {
      await writeAuditLog(client, {
        actorAdminId: req.adminUser.id,
        actorIsRoot: req.adminUser.is_root,
        permissionUsed: 'users.moderate',
        module: 'community',
        action: 'contributors.unfeatured',
        targetType: 'user',
        targetId: String(userId),
        reason: 'Removed from featured contributors',
      });
    }

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
