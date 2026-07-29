/**
 * Audit Log Router — cpa-manage-backend.
 * Allows admins to view audit log entries with permission check.
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const requirePermission = require('../middleware/requirePermission');

// ─── GET /admin/audit-log ──────────────────────────────────────────────────────
router.get('/', requirePermission('system.audit.view'), async (req, res, next) => {
  try {
    const { rows: logs } = await query(
      `SELECT
         a.id,
         a.actor_admin_id,
         a.actor_is_root,
         a.permission_used,
         a.module,
         a.action,
         a.target_type,
         a.target_id,
         a.reason,
         a.metadata,
         a.created_at,
         u.display_name as actor_name,
         u.email as actor_email
       FROM audit_log a
       LEFT JOIN admin_users u ON u.id = a.actor_admin_id
       ORDER BY a.created_at DESC
       LIMIT 200`
    );

    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
