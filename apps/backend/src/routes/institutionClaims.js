/**
 * Admin Institution Claims Router — cpa-manage-backend.
 */
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/db');
const { AppError } = require('../utils/errors');
const requirePermission = require('../middleware/requirePermission');
const { writeAuditLog } = require('../middleware/auditLog');

// ─── GET /admin/institution-claims ─────────────────────────────────────────────
router.get('/', requirePermission('claims.institution.view'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM institution_claims ORDER BY created_at DESC');
    res.json({ claims: rows });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /admin/institution-claims/:id/approve ────────────────────────────────
router.patch('/:id/approve', requirePermission('claims.institution.approve'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE institution_claims
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id::text = $2 RETURNING *`,
      [req.adminUser.id, id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('NOT_FOUND', 404));
    }

    const claim = rows[0];

    // Same-transaction audit log
    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'claims.institution.approve',
      module: 'claims',
      action: 'institution_claim.approved',
      targetType: 'institution_claim',
      targetId: String(claim.id),
      reason: 'Approved institution profile ownership claim',
    });

    await client.query('COMMIT');

    res.json({ claim });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── PATCH /admin/institution-claims/:id/reject ─────────────────────────────────
router.patch('/:id/reject', requirePermission('claims.institution.reject'), async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return next(new AppError('VALIDATION_ERROR', 400, { fields: { reason: 'required' } }));
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE institution_claims
       SET status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id::text = $3 RETURNING *`,
      [reason, req.adminUser.id, id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('NOT_FOUND', 404));
    }

    const claim = rows[0];

    // Same-transaction audit log
    await writeAuditLog(client, {
      actorAdminId: req.adminUser.id,
      actorIsRoot: req.adminUser.is_root,
      permissionUsed: 'claims.institution.reject',
      module: 'claims',
      action: 'institution_claim.rejected',
      targetType: 'institution_claim',
      targetId: String(claim.id),
      reason,
    });

    await client.query('COMMIT');

    res.json({ claim });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
