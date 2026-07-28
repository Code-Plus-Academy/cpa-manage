/**
 * Audit log writer helper (BACKEND_SPEC §8.2).
 * MUST be called inside the same DB transaction as the moderation write.
 */

async function writeAuditLog(dbClient, {
  actorAdminId,
  actorIsRoot,
  permissionUsed = null,
  module,
  action,
  targetType = null,
  targetId = null,
  reason = null,
  metadata = null,
}) {
  await dbClient.query(
    `INSERT INTO audit_log
       (actor_admin_id, actor_is_root, permission_used, module, action, target_type, target_id, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      actorAdminId,
      actorIsRoot,
      permissionUsed,
      module,
      action,
      targetType,
      targetId,
      reason,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

module.exports = { writeAuditLog };
