/**
 * Admin Contributors Management Router — cpa-manage-backend.
 * Allows managing platform contributors displayed on /contributors.
 */
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/db');
const { AppError } = require('../utils/errors');
const { writeAuditLog } = require('../middleware/auditLog');

// Helper to ensure the featured_contributors table and constraints exist
async function ensureContributorsTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS featured_contributors (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        role_title TEXT,
        badge TEXT,
        featured_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure UNIQUE index on user_id exists
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_contributors_user_id 
      ON featured_contributors (user_id);
    `);
  } catch (err) {
    console.warn('[Table Init Warning]:', err.message);
  }
}

/**
 * GET /admin/contributors
 * List all users with posts_count, is_featured, role_title, and badge.
 */
router.get('/', async (req, res, next) => {
  try {
    await ensureContributorsTable();

    const q = req.query.q ? `%${req.query.q.trim()}%` : null;

    let rows = [];
    try {
      let queryText = `
        SELECT
          u.id, u.username, u.name, u.email, u.avatar_url,
          u.account_type, u.created_at, u.bio, u.headline,
          COALESCE(
            (SELECT institution FROM user_education WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1),
            u.location,
            ''
          ) AS college_name,
          fc.role_title, fc.badge, fc.featured_at,
          (fc.user_id IS NOT NULL) AS is_featured,
          COALESCE((SELECT COUNT(*) FROM posts WHERE creator_id = u.id), 0)::int AS posts_count
        FROM users u
        LEFT JOIN featured_contributors fc ON fc.user_id::text = u.id::text
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
      // Resilient fallback query with core columns only
      let fallbackQuery = `
        SELECT
          u.id, u.username, u.name, u.email, u.avatar_url,
          u.account_type, u.created_at,
          fc.role_title, fc.badge, fc.featured_at,
          (fc.user_id IS NOT NULL) AS is_featured,
          0::int AS posts_count,
          '' AS college_name
        FROM users u
        LEFT JOIN featured_contributors fc ON fc.user_id::text = u.id::text
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
  try {
    let { user_id, username, role_title, badge } = req.body;

    await ensureContributorsTable();

    // 1. Resolve username to user_id if needed
    if (!user_id && username) {
      const cleanUsername = username.replace(/^@/, '').trim();
      const userRes = await query('SELECT id FROM users WHERE username ILIKE $1 LIMIT 1', [cleanUsername]);
      if (userRes.rows.length > 0) {
        user_id = userRes.rows[0].id;
      } else {
        return res.status(404).json({ error: { message: `User with username @${cleanUsername} not found.` } });
      }
    }

    if (!user_id) {
      return res.status(400).json({ error: { message: 'user_id or username is required' } });
    }

    const numericUserId = parseInt(user_id, 10);
    const finalUserId = isNaN(numericUserId) ? user_id : numericUserId;
    const finalRole = role_title ? String(role_title).trim() : 'Verified Notes Contributor';
    const finalBadge = badge ? String(badge).trim() : 'Top Reviewer';

    // 2. Check if user already exists in featured_contributors
    let featuredRow = null;
    const existing = await query('SELECT id FROM featured_contributors WHERE user_id = $1', [finalUserId]);

    if (existing.rows && existing.rows.length > 0) {
      // UPDATE
      const updateRes = await query(`
        UPDATE featured_contributors
        SET role_title = $1, badge = $2, featured_at = NOW()
        WHERE user_id = $3
        RETURNING *
      `, [finalRole, finalBadge, finalUserId]);
      featuredRow = updateRes.rows[0];
    } else {
      // INSERT
      const insertRes = await query(`
        INSERT INTO featured_contributors (user_id, role_title, badge, featured_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `, [finalUserId, finalRole, finalBadge]);
      featuredRow = insertRes.rows[0];
    }

    // 3. Non-blocking audit log
    if (req.adminUser) {
      try {
        const client = await getClient();
        await writeAuditLog(client, {
          actorAdminId: req.adminUser.id,
          actorIsRoot: req.adminUser.is_root,
          permissionUsed: 'users.moderate',
          module: 'community',
          action: 'contributors.featured',
          targetType: 'user',
          targetId: String(finalUserId),
          reason: `Featured as contributor with badge: ${finalBadge}`,
          metadata: { role_title: finalRole, badge: finalBadge },
        });
        client.release();
      } catch (auditErr) {
        console.warn('[Audit Log Warning]:', auditErr.message);
      }
    }

    res.status(200).json({ success: true, featured: featuredRow });
  } catch (err) {
    console.error('[POST /admin/contributors/feature]', err);
    res.status(500).json({ error: { message: err.message || 'Failed to feature contributor' } });
  }
});

/**
 * DELETE /admin/contributors/feature/:userId
 */
router.delete('/feature/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const numericUserId = parseInt(userId, 10);
    const finalUserId = isNaN(numericUserId) ? userId : numericUserId;

    await ensureContributorsTable();

    await query('DELETE FROM featured_contributors WHERE user_id = $1', [finalUserId]);

    // Non-blocking audit log
    if (req.adminUser) {
      try {
        const client = await getClient();
        await writeAuditLog(client, {
          actorAdminId: req.adminUser.id,
          actorIsRoot: req.adminUser.is_root,
          permissionUsed: 'users.moderate',
          module: 'community',
          action: 'contributors.unfeatured',
          targetType: 'user',
          targetId: String(finalUserId),
          reason: 'Removed from featured contributors',
        });
        client.release();
      } catch (auditErr) {
        console.warn('[Audit Log Warning]:', auditErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /admin/contributors/feature/:userId]', err);
    res.status(500).json({ error: { message: err.message || 'Failed to remove contributor' } });
  }
});

module.exports = router;
