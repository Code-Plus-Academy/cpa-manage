/**
 * Health check endpoint — verifies DB connection.
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

router.get('/', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', service: 'cpa-manage-backend', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database connection failed' });
  }
});

module.exports = router;
