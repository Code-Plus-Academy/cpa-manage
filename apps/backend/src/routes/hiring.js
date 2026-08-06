const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const documentTriggerService = require('../services/documentTriggerService');

// ─── GET /positions ──────────────────────────────────────────────────────────
router.get('/positions', async (req, res, next) => {
  try {
    const { status } = req.query;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`SELECT * FROM hiring_positions ${whereClause} ORDER BY created_at DESC`, values);
    
    res.json({ positions: result.rows });
  } catch (error) {
    next(error);
  }
});

// ─── POST /positions ─────────────────────────────────────────────────────────
router.post('/positions', async (req, res, next) => {
  try {
    const { title, description, status } = req.body;
    
    const result = await query(
      `INSERT INTO hiring_positions (title, description, status) 
       VALUES ($1, $2, $3) RETURNING *`,
      [title, description, status || 'open']
    );
    
    res.json({ position: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── GET /positions/:id ──────────────────────────────────────────────────────
router.get('/positions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM hiring_positions WHERE id = $1`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found' } });
    }
    
    res.json({ position: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /positions/:id ──────────────────────────────────────────────────────
router.put('/positions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;
    
    const result = await query(
      `UPDATE hiring_positions SET 
       title = COALESCE($1, title), 
       description = COALESCE($2, description), 
       status = COALESCE($3, status),
       updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [title, description, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found' } });
    }
    
    res.json({ position: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── GET /applications ───────────────────────────────────────────────────────
router.get('/applications', async (req, res, next) => {
  try {
    const { status, position_id } = req.query;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }
    
    if (position_id) {
      conditions.push(`position_id = $${idx++}`);
      values.push(position_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`SELECT * FROM hiring_applications ${whereClause} ORDER BY created_at DESC`, values);
    
    res.json({ applications: result.rows });
  } catch (error) {
    next(error);
  }
});

// ─── GET /applications/:id ───────────────────────────────────────────────────
router.get('/applications/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT a.*, p.title as position_title 
      FROM hiring_applications a
      LEFT JOIN hiring_positions p ON a.position_id = p.id
      WHERE a.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }
    
    res.json({ application: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /applications/:id/status ────────────────────────────────────────────
router.put('/applications/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await query(
      `UPDATE hiring_applications SET 
       status = $1, updated_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }
    
    res.json({ application: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── POST /applications/:id/approve ──────────────────────────────────────────
router.post('/applications/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `UPDATE hiring_applications SET 
       status = 'approved', updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }
    
    // Call document generation stub
    const docStatus = await documentTriggerService.triggerDocumentGeneration(id);
    
    res.json({ application: result.rows[0], document_status: docStatus });
  } catch (error) {
    next(error);
  }
});

// ─── GET /applications/:id/messages ──────────────────────────────────────────
router.get('/applications/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT * FROM hiring_messages WHERE application_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    
    res.json({ messages: result.rows });
  } catch (error) {
    next(error);
  }
});

// ─── POST /applications/:id/messages ─────────────────────────────────────────
router.post('/applications/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    const senderRole = 'admin';
    const senderId = req.adminUser ? req.adminUser.id : (req.admin ? req.admin.id : null);
    
    const result = await query(
      `INSERT INTO hiring_messages (application_id, sender_role, sender_id, message) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, senderRole, senderId, message]
    );
    
    res.json({ message: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── GET /applications/:id/tasks ─────────────────────────────────────────────
router.get('/applications/:id/tasks', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT * FROM hiring_tasks WHERE application_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    
    res.json({ tasks: result.rows });
  } catch (error) {
    next(error);
  }
});

// ─── POST /applications/:id/tasks ────────────────────────────────────────────
router.post('/applications/:id/tasks', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, due_date } = req.body;
    
    const result = await query(
      `INSERT INTO hiring_tasks (application_id, title, description, due_date, status) 
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [id, title, description, due_date]
    );
    
    res.json({ task: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /tasks/:taskId ──────────────────────────────────────────────────────
router.put('/tasks/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { status, progress } = req.body;
    
    const result = await query(
      `UPDATE hiring_tasks SET 
       status = COALESCE($1, status),
       progress = COALESCE($2, progress),
       updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, progress, taskId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }
    
    res.json({ task: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
