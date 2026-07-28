/**
 * Permission service — loads permissions for an admin user.
 */
const { query } = require('../config/db');

async function getPermissionsForAdmin(adminUserId) {
  const { rows } = await query(
    'SELECT permission_key FROM admin_user_permissions WHERE admin_user_id = $1',
    [adminUserId]
  );
  return rows.map(r => r.permission_key);
}

async function getAllPermissions() {
  const { rows } = await query('SELECT key, module, description FROM permissions ORDER BY module, key');
  return rows;
}

module.exports = {
  getPermissionsForAdmin,
  getAllPermissions,
};
