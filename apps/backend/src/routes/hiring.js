const express = require('express');
const router = express.Router();
const { query, getClient } = require('../config/db');
const documentTriggerService = require('../services/documentTriggerService');
const notificationService = require('../services/notificationService');
const crypto = require('crypto');

// Helper to generate human-readable sequential serial numbers (e.g. OFFER-2026-000142)
async function generateSequentialSerialNumber(docType = 'OFFER') {
  const year = new Date().getFullYear();
  const res = await query(
    `INSERT INTO hiring_document_counters (doc_type, year, last_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (doc_type, year)
     DO UPDATE SET last_value = hiring_document_counters.last_value + 1
     RETURNING last_value`,
    [docType.toUpperCase(), year]
  );
  const counter = res.rows[0].last_value;
  const paddedCounter = String(counter).padStart(6, '0');
  return `${docType.toUpperCase()}-${year}-${paddedCounter}`;
}

// Helper: normalize status — some rows may have integer status (from gRPC proto enum)
const STATUS_INT_MAP = { 0: 'draft', 1: 'draft', 2: 'upcoming', 3: 'open', 4: 'closed' };
function normalizeStatus(val) {
  if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
    return STATUS_INT_MAP[Number(val)] || 'draft';
  }
  return typeof val === 'string' ? val.toLowerCase().trim() : 'draft';
}

// ─── 1. POSITION MANAGEMENT ───────────────────────────────────────────────────

// GET /positions — List positions with department, status, type, search filters
router.get('/positions', async (req, res, next) => {
  try {
    const { status, department, search } = req.query;
    const conditions = [];
    const values = [];
    let idx = 1;

    const isPublicRoute = req.baseUrl.includes('/api/hiring') || req.baseUrl.includes('/api/career') || req.baseUrl.includes('/api/careers') || !req.admin;

    if (isPublicRoute) {
      if (status === 'upcoming') {
        conditions.push(`LOWER(status) = 'upcoming'`);
      } else if (status === 'closed') {
        conditions.push(`LOWER(status) IN ('closed', 'archived')`);
      } else if (status === 'open_only') {
        conditions.push(`LOWER(status) = 'open'`);
      } else {
        // By default on public routes, show all non-draft positions (open, upcoming, closed)
        conditions.push(`LOWER(status) != 'draft'`);
      }
    } else {
      if (status === 'public') {
        conditions.push(`LOWER(status) != 'draft'`);
      } else if (status) {
        conditions.push(`LOWER(status) = LOWER($${idx++})`);
        values.push(status);
      }
    }
    if (department) {
      conditions.push(`department = $${idx++}`);
      values.push(department);
    }
    if (search) {
      conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM hiring_applications a WHERE a.position_id::text = p.id::text)::int AS applicant_count
       FROM hiring_positions p
       ${whereClause}
       ORDER BY created_at DESC`,
      values
    );

    const positions = result.rows.map(p => ({
      ...p,
      status: normalizeStatus(p.status)
    }));

    res.json({ positions });
  } catch (error) {
    next(error);
  }
});

// POST /positions — Create position
router.post('/positions', async (req, res, next) => {
  try {
    const {
      title, department, type, status, description, openings,
      location, requirements, responsibilities, salary_range,
      application_deadline, auto_response_enabled, custom_form_fields
    } = req.body;

    const result = await query(
      `INSERT INTO hiring_positions (
        title, department, type, status, description, openings,
        location, requirements, responsibilities, salary_range,
        application_deadline, auto_response_enabled, custom_form_fields
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        title || 'Untitled Role',
        department || 'Engineering',
        type || 'intern',
        status || 'draft',
        description || '',
        openings || 1,
        location || 'remote',
        requirements || '',
        responsibilities || '',
        salary_range || null,
        application_deadline || null,
        auto_response_enabled !== undefined ? auto_response_enabled : true,
        JSON.stringify(custom_form_fields || [])
      ]
    );

    const position = result.rows[0];

    await query(
      `INSERT INTO hiring_position_history (position_id, changed_by, change_type, changes)
       VALUES ($1, $2, 'create', $3)`,
      [position.id, req.admin?.id || null, JSON.stringify(position)]
    );

    res.json({ position });
  } catch (error) {
    next(error);
  }
});

// GET /positions/:id — Get position details + audit log
router.get('/positions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const posRes = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM hiring_applications a WHERE a.position_id::text = p.id::text)::int AS applicant_count
       FROM hiring_positions p WHERE id::text = $1`,
      [id]
    );

    if (posRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found' } });
    }

    const historyRes = await query(
      `SELECT * FROM hiring_position_history WHERE position_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json({ position: posRes.rows[0], history: historyRes.rows });
  } catch (error) {
    next(error);
  }
});

// PUT /positions/:id — Update position
router.put('/positions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title, department, type, status, description, openings,
      location, requirements, responsibilities, salary_range,
      application_deadline, auto_response_enabled, custom_form_fields
    } = req.body;

    const result = await query(
      `UPDATE hiring_positions SET
        title = COALESCE($1, title),
        department = COALESCE($2, department),
        type = COALESCE($3, type),
        status = COALESCE($4, status),
        description = COALESCE($5, description),
        openings = COALESCE($6, openings),
        location = COALESCE($7, location),
        requirements = COALESCE($8, requirements),
        responsibilities = COALESCE($9, responsibilities),
        salary_range = COALESCE($10, salary_range),
        application_deadline = COALESCE($11, application_deadline),
        auto_response_enabled = COALESCE($12, auto_response_enabled),
        custom_form_fields = COALESCE($13, custom_form_fields),
        updated_at = NOW()
       WHERE id = $14 RETURNING *`,
      [
        title, department, type, status, description, openings,
        location, requirements, responsibilities, salary_range,
        application_deadline, auto_response_enabled,
        custom_form_fields ? JSON.stringify(custom_form_fields) : null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found' } });
    }

    const position = result.rows[0];

    await query(
      `INSERT INTO hiring_position_history (position_id, changed_by, change_type, changes)
       VALUES ($1, $2, 'update', $3)`,
      [position.id, req.admin?.id || null, JSON.stringify(req.body)]
    );

    res.json({ position });
  } catch (error) {
    next(error);
  }
});

// POST /positions/:id/duplicate — Duplicate position as draft
router.post('/positions/:id/duplicate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const origRes = await query(`SELECT * FROM hiring_positions WHERE id = $1`, [id]);
    if (origRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found' } });
    }

    const orig = origRes.rows[0];
    const dupRes = await query(
      `INSERT INTO hiring_positions (
        title, department, type, status, description, openings,
        location, requirements, responsibilities, salary_range,
        auto_response_enabled, custom_form_fields
       ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        `${orig.title} (Copy)`,
        orig.department,
        orig.type,
        orig.description,
        orig.openings,
        orig.location,
        orig.requirements,
        orig.responsibilities,
        orig.salary_range,
        orig.auto_response_enabled,
        JSON.stringify(orig.custom_form_fields || [])
      ]
    );

    res.json({ position: dupRes.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /positions/:id/archive — Archive / Close position
router.patch('/positions/:id/archive', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE hiring_positions SET status = 'closed', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found' } });
    }
    res.json({ message: 'Position archived/closed successfully', position: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /positions/:id — Delete position
router.delete('/positions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if candidate applications are attached to this position
    const appCheck = await query(
      `SELECT COUNT(*)::int AS count FROM hiring_applications WHERE position_id::text = $1`,
      [id]
    );

    const appCount = appCheck.rows[0]?.count || 0;
    if (appCount > 0) {
      return res.status(400).json({
        error: {
          code: 'HAS_APPLICATIONS',
          message: `Cannot delete position because ${appCount} candidate application(s) are attached to it. Please archive or close the position instead.`
        }
      });
    }

    const result = await query(`DELETE FROM hiring_positions WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found' } });
    }
    res.json({ message: 'Position deleted successfully', position: result.rows[0] });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        error: {
          code: 'HAS_REFERENCED_RECORDS',
          message: 'Cannot delete position because linked candidate applications or records exist. Please archive or close the position instead.'
        }
      });
    }
    next(error);
  }
});

// ─── 2. CANDIDATE & APPLICATION PIPELINE ──────────────────────────────────────

// POST /applications/apply — Submit candidate application for a position
router.post('/applications/apply', async (req, res, next) => {
  try {
    const { position_id, name, email, phone, resume_url, cover_letter, answers } = req.body;

    if (!position_id || !name || !email) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'position_id, name, and email are required.' } });
    }

    // 1. Verify position exists
    const posRes = await query(`SELECT * FROM hiring_positions WHERE id = $1`, [position_id]);
    if (posRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Position not found.' } });
    }
    const position = posRes.rows[0];

    // 2. Lookup or create candidate
    let candidateId;
    const candRes = await query(`SELECT id FROM hiring_candidates WHERE email ILIKE $1`, [email.trim()]);
    if (candRes.rows.length > 0) {
      candidateId = candRes.rows[0].id;
    } else {
      const newCand = await query(
        `INSERT INTO hiring_candidates (name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
        [name.trim(), email.trim(), phone ? phone.trim() : null]
      );
      candidateId = newCand.rows[0].id;
    }

    // 3. Check for existing active application for this position
    const existingApp = await query(
      `SELECT id FROM hiring_applications WHERE candidate_id::text = $1 AND position_id::text = $2 AND status != 'rejected'`,
      [candidateId, position_id]
    );
    if (existingApp.rows.length > 0) {
      return res.status(400).json({
        error: { code: 'ALREADY_APPLIED', message: 'You have already submitted an active application for this position.' }
      });
    }

    // 4. Insert application
    const appRes = await query(
      `INSERT INTO hiring_applications (candidate_id, position_id, resume_url, cover_letter, status, answers)
       VALUES ($1, $2, $3, $4, 'applied', $5) RETURNING *`,
      [candidateId, position_id, resume_url || null, cover_letter || null, JSON.stringify(answers || {})]
    );
    const application = appRes.rows[0];

    // 5. Log audit trail event
    await query(
      `INSERT INTO hiring_application_history (application_id, changed_by, event_type, notes)
       VALUES ($1, 'candidate', 'applied', $2)`,
      [application.id, `Candidate ${name} applied for position ${position.title}`]
    );

    res.json({ message: 'Application submitted successfully!', application });
  } catch (error) {
    next(error);
  }
});

// GET /my-applications — List applications for a candidate with generated documents
router.get('/my-applications', async (req, res, next) => {
  try {
    const { candidate_id, email } = req.query;
    if (!candidate_id && !email) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'candidate_id or email is required' } });
    }

    let whereClause = '';
    const values = [];
    if (candidate_id && email) {
      whereClause = `WHERE (a.candidate_id::text = $1 OR c.id::text = $1 OR c.email ILIKE $2)`;
      values.push(candidate_id, email);
    } else if (candidate_id) {
      whereClause = `WHERE (a.candidate_id::text = $1 OR c.id::text = $1)`;
      values.push(candidate_id);
    } else {
      whereClause = `WHERE c.email ILIKE $1`;
      values.push(email);
    }

    const result = await query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email, c.phone AS candidate_phone,
              p.title AS position_title, p.department AS position_department, p.type AS position_type, p.location AS position_location,
              (SELECT json_agg(d) FROM hiring_generated_documents d WHERE d.application_id::text = a.id::text) AS documents
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id::text = c.id::text
       JOIN hiring_positions p ON a.position_id::text = p.id::text
       ${whereClause}
       ORDER BY a.applied_at DESC`,
      values
    );

    res.json({ applications: result.rows });
  } catch (error) {
    console.error('Error fetching my-applications:', error);
    res.json({ applications: [] });
  }
});

// GET /applications — List applications
router.get('/applications', async (req, res, next) => {
  try {
    const { status, position_id, search, candidate_id, candidate_email } = req.query;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (status) {
      conditions.push(`a.status = $${idx++}`);
      values.push(status);
    }
    if (position_id) {
      conditions.push(`a.position_id = $${idx++}`);
      values.push(position_id);
    }
    if (candidate_id) {
      conditions.push(`(a.candidate_id = $${idx} OR c.id::text = $${idx})`);
      values.push(candidate_id);
      idx++;
    }
    if (candidate_email) {
      conditions.push(`c.email ILIKE $${idx}`);
      values.push(candidate_email);
      idx++;
    }
    if (search) {
      conditions.push(`(c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR p.title ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email, c.phone AS candidate_phone,
              p.title AS position_title, p.department AS position_department, p.type AS position_type,
              (SELECT json_agg(d) FROM hiring_generated_documents d WHERE d.application_id::text = a.id::text) AS documents
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id::text = c.id::text
       JOIN hiring_positions p ON a.position_id::text = p.id::text
       ${whereClause}
       ORDER BY a.applied_at DESC`,
      values
    );

    res.json({ applications: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /applications/:id — Detailed view
router.get('/applications/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const appRes = await query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email, c.phone AS candidate_phone,
              p.title AS position_title, p.department AS position_department, p.type AS position_type,
              p.description AS position_description, p.custom_form_fields
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id::text = c.id::text
       JOIN hiring_positions p ON a.position_id::text = p.id::text
       WHERE a.id::text = $1`,
      [id]
    );

    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const notesRes = await query(
      `SELECT * FROM hiring_application_notes WHERE application_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const historyRes = await query(
      `SELECT * FROM hiring_application_history WHERE application_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const docsRes = await query(
      `SELECT * FROM hiring_generated_documents WHERE application_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      application: appRes.rows[0],
      notes: notesRes.rows,
      history: historyRes.rows,
      documents: docsRes.rows
    });
  } catch (error) {
    next(error);
  }
});

// PUT /applications/:id/status — Status transition
router.put('/applications/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, rejection_reason, rejection_notes } = req.body;

    const oldApp = await query(`SELECT status FROM hiring_applications WHERE id = $1`, [id]);
    if (oldApp.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }
    const fromStatus = oldApp.rows[0].status;

    const result = await query(
      `UPDATE hiring_applications SET
        status = COALESCE($1, status),
        notes = COALESCE($2, notes),
        rejection_reason = COALESCE($3, rejection_reason),
        rejection_notes = COALESCE($4, rejection_notes),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, notes, rejection_reason, rejection_notes, id]
    );

    const application = result.rows[0];

    if (status && status !== fromStatus) {
      await query(
        `INSERT INTO hiring_application_history (application_id, changed_by, changed_by_name, from_status, to_status, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, req.admin?.id || null, req.admin?.display_name || 'Admin', fromStatus, status, rejection_reason || notes || 'Status updated']
      );

      notificationService.notifyCandidateStatusChange(id, status);
    }

    res.json({ application });
  } catch (error) {
    next(error);
  }
});

// POST /applications/bulk-move — Bulk move
router.post('/applications/bulk-move', async (req, res, next) => {
  try {
    const { application_ids, target_status } = req.body;
    if (!Array.isArray(application_ids) || !target_status) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing application_ids array or target_status' } });
    }

    await query(
      `UPDATE hiring_applications SET status = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
      [target_status, application_ids]
    );

    res.json({ message: `Successfully updated ${application_ids.length} applications to ${target_status}` });
  } catch (error) {
    next(error);
  }
});

// POST /applications/bulk-reject — Bulk reject
router.post('/applications/bulk-reject', async (req, res, next) => {
  try {
    const { application_ids, rejection_reason } = req.body;
    if (!Array.isArray(application_ids)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing application_ids array' } });
    }

    await query(
      `UPDATE hiring_applications SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
      [rejection_reason || 'Position filled', application_ids]
    );

    res.json({ message: `Successfully rejected ${application_ids.length} applications` });
  } catch (error) {
    next(error);
  }
});

// POST /applications/:id/notes — Add note
router.post('/applications/:id/notes', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Note content is required' } });
    }

    const result = await query(
      `INSERT INTO hiring_application_notes (application_id, admin_id, admin_name, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, req.admin?.id || null, req.admin?.display_name || 'Admin', note.trim()]
    );

    res.json({ note: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── 3. CHAT & MESSENGER ─────────────────────────────────────────────────────

// GET /applications/:id/messages — Fetch message history
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

// POST /applications/:id/messages — Send message
router.post('/applications/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Message body required' } });
    }

    const result = await query(
      `INSERT INTO hiring_messages (application_id, sender_role, sender_id, body)
       VALUES ($1, 'admin', $2, $3) RETURNING *`,
      [id, req.admin?.id || 'admin', body.trim()]
    );

    const message = result.rows[0];
    notificationService.notifyCandidateNewMessage(id);

    res.json({ message });
  } catch (error) {
    next(error);
  }
});

// ─── 4. APPROVAL WORKFLOW & OFFER LETTER PREVIEW ─────────────────────────────

// POST /applications/:id/approve-preview — Render Jinja2 HTML preview for Offer Letter using PolyCert Studio
router.post('/applications/:id/approve-preview', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { template_name, data: providedData } = req.body;
    const formFields = providedData || req.body || {};

    const appRes = await query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email, p.title AS position_title
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id = c.id
       JOIN hiring_positions p ON a.position_id = p.id
       WHERE a.id = $1`,
      [id]
    );

    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const app = appRes.rows[0];
    const targetTemplate = template_name || req.body.template_name || 'offer_letter.html';
    const previewSerial = `OFFER-${new Date().getFullYear()}-PREVIEW`;

    const templateData = {
      name: app.candidate_name,
      role: formFields.role || formFields.offer_title || app.position_title,
      company_name: formFields.company_name || formFields.organization_name || 'Code+ Academy',
      organization_name: formFields.organization_name || 'Code Plus Academy',
      holding_company: 'Code Plus Education',
      serial_no: previewSerial,
      date: formFields.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      duration: formFields.duration || '6 Months',
      compensation: formFields.compensation || '$85,000 / Year',
      signatory: formFields.signatory || 'Dr. Alex Vance',
      signatory_role: formFields.signatory_role || 'Director of Engineering',
      signature_text: formFields.signature_text || formFields.signatory || 'Dr. Alex Vance',
      ...formFields
    };

    const previewResult = await documentTriggerService.renderPolyCertTemplatePreview(targetTemplate, templateData);

    res.json({
      preview_html: previewResult.rendered_html,
      variables_detected: previewResult.variables,
      filename: previewResult.filename,
      candidate_name: app.candidate_name,
      candidate_email: app.candidate_email
    });
  } catch (error) {
    next(error);
  }
});

// POST /applications/:id/approve-confirm — Commit approval & dispatch offer with atomic sequential serial via PolyCert Studio
router.post('/applications/:id/approve-confirm', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { template_name, data: providedData } = req.body;
    const formFields = providedData || req.body || {};

    const appRes = await query(
      `UPDATE hiring_applications SET status = 'approved', offer_status = 'sent', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const app = appRes.rows[0];
    const targetTemplate = template_name || req.body.template_name || 'offer_letter.html';
    const serialNumber = await generateSequentialSerialNumber('OFFER');
    const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();

    // Log document in hiring_generated_documents
    const docRes = await query(
      `INSERT INTO hiring_generated_documents (
        application_id, document_type, rendered_html, serial_number, verification_code, document_version, variables_used, sent_to
       ) VALUES ($1, 'offer_letter', $2, $3, $4, 1, $5, $6)
       RETURNING *`,
      [
        id,
        `<div>Offer Letter HTML for candidate (${serialNumber})</div>`,
        serialNumber,
        verificationCode,
        JSON.stringify(formFields),
        app.candidate_email || 'candidate@example.com'
      ]
    );

    const docTriggerStatus = await documentTriggerService.triggerDocumentGeneration(id, {
      document_type: 'offer_letter',
      template_name: targetTemplate,
      serial_number: serialNumber,
      role: formFields.role || formFields.offer_title || app.position_title,
      company_name: formFields.company_name || 'Code+ Academy',
      organization_name: formFields.organization_name || 'Code Plus Academy',
      compensation: formFields.compensation || 'Standard Rate',
      signatory: formFields.signatory || 'Dr. Alex Vance',
      signatory_role: formFields.signatory_role || 'Director of Engineering',
      signature_text: formFields.signature_text || 'Dr. Alex Vance',
      admin_email: req.adminUser?.email || req.admin?.email,
      admin_name: req.adminUser?.display_name || req.admin?.display_name,
      ...formFields
    });

    res.json({
      application: app,
      document: docRes.rows[0],
      serial_number: serialNumber,
      verification_code: verificationCode,
      document_trigger_status: docTriggerStatus,
      message: `Application approved and offer letter ${serialNumber} dispatched.`
    });
  } catch (error) {
    next(error);
  }
});

// GET /polycert/templates — Fetch installed Jinja2 templates directly from PolyCert Studio API
router.get('/polycert/templates', async (req, res, next) => {
  try {
    const templates = await documentTriggerService.fetchPolyCertTemplates();
    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

// GET /polycert/templates/:filename — Fetch raw HTML & Jinja2 placeholders for a template
router.get('/polycert/templates/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params;
    const templateData = await documentTriggerService.getPolyCertTemplateHtml(filename);
    res.json(templateData);
  } catch (error) {
    next(error);
  }
});

// POST /polycert/templates — Create or update custom Jinja2 template on PolyCert Studio
router.post('/polycert/templates', async (req, res, next) => {
  try {
    const { name, html } = req.body;
    if (!name || !html) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Both name and html are required' } });
    }
    const result = await documentTriggerService.savePolyCertTemplate(name, html);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /polycert/templates/:filename — Delete custom template from PolyCert Studio
router.delete('/polycert/templates/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params;
    const result = await documentTriggerService.deletePolyCertTemplate(filename);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /applications/:id/issue-certificate-preview — Fetch Jinja2 template from PolyCert Studio API & render HTML preview
router.post('/applications/:id/issue-certificate-preview', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { template_name, data: providedData } = req.body;

    // Sequential Lifecycle Check: Verify an Offer Letter has already been issued
    const offerCheck = await query(
      `SELECT COUNT(*) FROM hiring_generated_documents WHERE application_id = $1 AND (document_type = 'offer_letter' OR document_type = 'offer')`,
      [id]
    );

    if (parseInt(offerCheck.rows[0].count, 10) === 0) {
      return res.status(400).json({
        error: {
          code: 'OFFER_LETTER_REQUIRED',
          message: 'An Offer Letter must be issued before generating a Certificate of Completion.'
        }
      });
    }

    const appRes = await query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email, p.title AS position_title
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id = c.id
       JOIN hiring_positions p ON a.position_id = p.id
       WHERE a.id = $1`,
      [id]
    );

    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const app = appRes.rows[0];
    const targetTemplate = template_name || req.body.template_name || 'certificate.html';
    const previewSerial = `CERT-${new Date().getFullYear()}-PREVIEW`;
    const formFields = providedData || req.body || {};

    const templateData = {
      name: app.candidate_name,
      role: formFields.role || formFields.role_title || app.position_title,
      organization_name: formFields.organization_name || 'Code Plus Academy',
      company_name: formFields.company_name || formFields.organization_name || 'Code+ Academy',
      holding_company: 'Code Plus Education',
      serial_no: previewSerial,
      date: formFields.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      duration: formFields.duration || '6 Months',
      signatory: formFields.signatory || 'Dr. Alex Vance',
      signatory_role: formFields.signatory_role || 'Director of Engineering',
      signature_text: formFields.signature_text || formFields.signatory || 'Dr. Alex Vance',
      doc_tag: 'OFFICIAL CERTIFICATE',
      eyebrow: 'CODE PLUS ACADEMY CREDENTIAL',
      ...formFields
    };

    const previewResult = await documentTriggerService.renderPolyCertTemplatePreview(targetTemplate, templateData);

    res.json({
      preview_html: previewResult.rendered_html,
      variables_detected: previewResult.variables,
      filename: previewResult.filename,
      candidate_name: app.candidate_name,
      candidate_email: app.candidate_email
    });
  } catch (error) {
    next(error);
  }
});

// POST /applications/:id/issue-certificate-confirm — Issue certificate & dispatch via PDF automation
router.post('/applications/:id/issue-certificate-confirm', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { template_name, data: providedData } = req.body;
    const formFields = providedData || req.body || {};

    // Sequential Lifecycle Check: Verify an Offer Letter has already been issued
    const offerCheck = await query(
      `SELECT COUNT(*) FROM hiring_generated_documents WHERE application_id = $1 AND (document_type = 'offer_letter' OR document_type = 'offer')`,
      [id]
    );

    if (parseInt(offerCheck.rows[0].count, 10) === 0) {
      return res.status(400).json({
        error: {
          code: 'OFFER_LETTER_REQUIRED',
          message: 'An Offer Letter must be issued before generating a Certificate of Completion.'
        }
      });
    }

    const appRes = await query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email, p.title AS position_title
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id = c.id
       JOIN hiring_positions p ON a.position_id = p.id
       WHERE a.id = $1`,
      [id]
    );

    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const app = appRes.rows[0];
    const targetTemplate = template_name || req.body.template_name || 'certificate.html';
    const isOffer = targetTemplate.includes('offer');
    const serialPrefix = isOffer ? 'OFFER' : 'CERT';
    const serialNumber = await generateSequentialSerialNumber(serialPrefix);
    const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();

    const docType = isOffer ? 'offer_letter' : 'certificate';

    // Log document in hiring_generated_documents
    const docRes = await query(
      `INSERT INTO hiring_generated_documents (
        application_id, document_type, rendered_html, serial_number, verification_code, document_version, variables_used, sent_to
       ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7)
       RETURNING *`,
      [
        id,
        docType,
        `<div>Generated ${docType} for ${app.candidate_name} (${serialNumber})</div>`,
        serialNumber,
        verificationCode,
        JSON.stringify(formFields),
        app.candidate_email || 'candidate@example.com'
      ]
    );

    const docTriggerStatus = await documentTriggerService.triggerDocumentGeneration(id, {
      document_type: docType,
      template_name: targetTemplate,
      serial_number: serialNumber,
      role: formFields.role || formFields.role_title || app.position_title,
      duration: formFields.duration,
      organization_name: formFields.organization_name,
      signatory: formFields.signatory,
      signatory_role: formFields.signatory_role,
      signature_text: formFields.signature_text,
      admin_email: req.adminUser?.email || req.admin?.email,
      admin_name: req.adminUser?.display_name || req.admin?.display_name,
      ...formFields
    });

    notificationService.notifyCandidateStatusChange(id, 'certificate_issued');

    res.json({
      application: app,
      document: docRes.rows[0],
      serial_number: serialNumber,
      verification_code: verificationCode,
      document_trigger_status: docTriggerStatus,
      message: `Certificate ${serialNumber} issued and dispatched to ${app.candidate_email}.`
    });
  } catch (error) {
    next(error);
  }
});

// ─── 5. INTERN TASK MANAGEMENT ────────────────────────────────────────────────

// GET /applications/:id/tasks — Get intern tasks
router.get('/applications/:id/tasks', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT * FROM hiring_intern_tasks WHERE application_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    res.json({ tasks: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /applications/:id/tasks — Create task
router.post('/applications/:id/tasks', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, due_date, progress } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Task title is required' } });
    }

    const result = await query(
      `INSERT INTO hiring_intern_tasks (application_id, title, due_date, progress)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, title.trim(), due_date || null, progress || 0]
    );

    res.json({ task: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /tasks/:taskId — Update task
router.put('/tasks/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { status, progress, title } = req.body;

    const result = await query(
      `UPDATE hiring_intern_tasks SET
        status = COALESCE($1, status),
        progress = COALESCE($2, progress),
        title = COALESCE($3, title)
       WHERE id = $4 RETURNING *`,
      [status, progress, title, taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── 6. DOCUMENT TEMPLATES & VERSIONING ───────────────────────────────────────

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'http://127.0.0.1:5000';

async function syncTemplateToPDFService(title, htmlContent) {
  if (!htmlContent) return;
  try {
    const safeName = (title || 'template').replace(/[^a-zA-Z0-9_-]/g, '_');
    await fetch(`${PDF_SERVICE_URL}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: safeName, html: htmlContent })
    });
    console.log(`[TemplateSync] Successfully synced template '${safeName}' to PDF Service at ${PDF_SERVICE_URL}`);
  } catch (err) {
    console.warn(`[TemplateSync] Could not sync template to PDF Service: ${err.message}`);
  }
}

// GET /templates — List document templates
router.get('/templates', async (req, res, next) => {
  try {
    const result = await query(`SELECT * FROM hiring_document_templates ORDER BY created_at DESC`);
    res.json({ templates: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /templates — Create template
router.post('/templates', async (req, res, next) => {
  try {
    const { title, type, html_content, variables, is_active } = req.body;

    let varsArray = ['candidate_name', 'position_title', 'start_date', 'compensation'];
    if (Array.isArray(variables)) {
      varsArray = variables;
    } else if (typeof variables === 'string') {
      try { varsArray = JSON.parse(variables); } catch (_) {}
    }

    if (is_active !== false) {
      await query(`UPDATE hiring_document_templates SET is_active = false WHERE type = $1`, [type || 'offer_letter']);
    }

    const result = await query(
      `INSERT INTO hiring_document_templates (title, type, html_content, variables, is_active, version)
       VALUES ($1, $2, $3, $4::jsonb, $5, 1) RETURNING *`,
      [
        title || 'Untitled Template',
        type || 'offer_letter',
        html_content || '<div style="padding: 20px;"><h2>Template Header</h2><p>Dear {{candidate_name}}, welcome!</p></div>',
        JSON.stringify(varsArray),
        is_active !== false
      ]
    );

    const template = result.rows[0];

    await query(
      `INSERT INTO hiring_document_template_versions (template_id, version, html_content, variables, created_by)
       VALUES ($1, 1, $2, $3::jsonb, $4)`,
      [template.id, template.html_content, JSON.stringify(varsArray), req.admin?.id || null]
    );

    syncTemplateToPDFService(template.title, template.html_content);

    res.json({ template });
  } catch (error) {
    next(error);
  }
});

// PUT /templates/:id — Update template & log version history
router.put('/templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, type, html_content, variables, is_active } = req.body;

    const oldRes = await query(`SELECT * FROM hiring_document_templates WHERE id = $1`, [id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    const oldTpl = oldRes.rows[0];
    const newVersion = (oldTpl.version || 1) + 1;

    if (is_active === true) {
      await query(`UPDATE hiring_document_templates SET is_active = false WHERE type = $1 AND id != $2`, [oldTpl.type || type, id]);
    }

    let varsJson = null;
    let varsArray = oldTpl.variables || [];
    if (variables !== undefined) {
      if (Array.isArray(variables)) {
        varsArray = variables;
      } else if (typeof variables === 'string') {
        try { varsArray = JSON.parse(variables); } catch (_) {}
      }
      varsJson = JSON.stringify(varsArray);
    }

    const result = await query(
      `UPDATE hiring_document_templates SET
        title = COALESCE($1, title),
        type = COALESCE($2, type),
        html_content = COALESCE($3, html_content),
        variables = COALESCE($4::jsonb, variables),
        is_active = COALESCE($5, is_active),
        version = $6,
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        title, type, html_content,
        varsJson,
        is_active, newVersion, id
      ]
    );

    const template = result.rows[0];

    await query(
      `INSERT INTO hiring_document_template_versions (template_id, version, html_content, variables, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [template.id, newVersion, template.html_content, JSON.stringify(varsArray), req.admin?.id || null]
    );

    syncTemplateToPDFService(template.title, template.html_content);

    res.json({ template });
  } catch (error) {
    next(error);
  }
});

// GET /templates/:id/versions — Version history for template
router.get('/templates/:id/versions', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT v.*, a.display_name AS created_by_name
       FROM hiring_document_template_versions v
       LEFT JOIN admin_users a ON v.created_by = a.id
       WHERE v.template_id = $1 ORDER BY v.version DESC`,
      [id]
    );
    res.json({ versions: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /templates/:id/preview — Live HTML preview with dummy data
router.post('/templates/:id/preview', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dummy_data } = req.body;

    const tplRes = await query(`SELECT * FROM hiring_document_templates WHERE id = $1`, [id]);
    if (tplRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    const tpl = tplRes.rows[0];
    let rendered = tpl.html_content;

    const sample = dummy_data || {
      candidate_name: 'Alex Johnson',
      position_title: 'Full-Stack Software Engineer',
      start_date: 'September 1, 2026',
      compensation: '$120,000 / year',
      serial_number: 'OFFER-2026-000001',
      verification_code: 'VERIFY-99A8B7',
      issued_date: new Date().toLocaleDateString()
    };

    Object.entries(sample).forEach(([k, v]) => {
      rendered = rendered.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), v);
    });

    res.json({ rendered_html: rendered, sample_used: sample });
  } catch (error) {
    next(error);
  }
});

// DELETE /templates/:id — Delete template and sync deletion to PDF Service
router.delete('/templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tplRes = await query(`SELECT * FROM hiring_document_templates WHERE id = $1`, [id]);
    if (tplRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    const tpl = tplRes.rows[0];
    await query(`DELETE FROM hiring_document_templates WHERE id = $1`, [id]);

    const safeName = (tpl.title || 'template').replace(/[^a-zA-Z0-9_-]/g, '_');
    fetch(`${PDF_SERVICE_URL}/api/templates/${safeName}.html`, { method: 'DELETE' }).catch(() => {});

    res.json({ message: `Template '${tpl.title}' deleted successfully` });
  } catch (error) {
    next(error);
  }
});

// GET /documents — Generated documents log
router.get('/documents', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.*, c.name AS candidate_name, c.email AS candidate_email
       FROM hiring_generated_documents d
       JOIN hiring_applications a ON d.application_id = a.id
       JOIN hiring_candidates c ON a.candidate_id = c.id
       ORDER BY d.created_at DESC`
    );
    res.json({ documents: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /documents/:id/resend — Resend & increment document version with linkage
router.post('/documents/:id/resend', async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRes = await query(`SELECT * FROM hiring_generated_documents WHERE id = $1`, [id]);
    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    const origDoc = docRes.rows[0];
    const newVersionNumber = (origDoc.document_version || 1) + 1;
    const newSerial = await generateSequentialSerialNumber(origDoc.document_type || 'OFFER');
    const newVerificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();

    const newDocRes = await query(
      `INSERT INTO hiring_generated_documents (
        application_id, template_id, document_type, rendered_html, serial_number,
        verification_code, document_version, previous_document_id, variables_used, sent_to
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        origDoc.application_id,
        origDoc.template_id,
        origDoc.document_type,
        origDoc.rendered_html,
        newSerial,
        newVerificationCode,
        newVersionNumber,
        origDoc.id,
        origDoc.variables_used,
        origDoc.sent_to
      ]
    );

    notificationService.notifyCandidateStatusChange(origDoc.application_id, 'document_resent');

    res.json({
      message: `Successfully generated version ${newVersionNumber} (${newSerial}) and resent to ${origDoc.sent_to}`,
      document: newDocRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// GET /settings — Get system hiring & document settings
router.get('/settings', async (req, res, next) => {
  try {
    const result = await query(`SELECT * FROM hiring_settings WHERE id = 1`);
    res.json({ settings: result.rows[0] || {} });
  } catch (error) {
    next(error);
  }
});

// PUT /settings — Update settings with input validation
router.put('/settings', async (req, res, next) => {
  try {
    const { company_logo_url, letterhead_header_html, signature_image_url, default_sender_email, default_sender_name } = req.body;

    if (default_sender_email && !default_sender_email.includes('@')) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid default sender email format' } });
    }

    const result = await query(
      `UPDATE hiring_settings SET
        company_logo_url = COALESCE($1, company_logo_url),
        letterhead_header_html = COALESCE($2, letterhead_header_html),
        signature_image_url = COALESCE($3, signature_image_url),
        default_sender_email = COALESCE($4, default_sender_email),
        default_sender_name = COALESCE($5, default_sender_name),
        updated_at = NOW()
       WHERE id = 1 RETURNING *`,
      [company_logo_url, letterhead_header_html, signature_image_url, default_sender_email, default_sender_name]
    );

    res.json({ settings: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /analytics/overview — Overview cards & funnel metrics
router.get('/analytics/overview', async (req, res, next) => {
  try {
    const posCount = await query(`SELECT COUNT(*)::int AS count FROM hiring_positions WHERE status = 'open'`);
    const appCount = await query(`SELECT COUNT(*)::int AS count FROM hiring_applications`);
    const pendingCount = await query(`SELECT COUNT(*)::int AS count FROM hiring_applications WHERE status IN ('applied', 'in_review')`);
    const approvedCount = await query(`SELECT COUNT(*)::int AS count FROM hiring_applications WHERE status = 'approved'`);

    const funnelRes = await query(
      `SELECT status, COUNT(*)::int AS count FROM hiring_applications GROUP BY status`
    );

    res.json({
      open_positions: posCount.rows[0].count,
      total_applications: appCount.rows[0].count,
      pending_review: pendingCount.rows[0].count,
      approved_this_month: approvedCount.rows[0].count,
      funnel: funnelRes.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /analytics/position-wise — Per-position funnel breakdown & conversion metrics
router.get('/analytics/position-wise', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.id AS position_id, p.title AS position_title, p.department, p.status AS position_status,
              COUNT(a.id)::int AS total_applications,
              COUNT(CASE WHEN a.status = 'applied' THEN 1 END)::int AS applied_count,
              COUNT(CASE WHEN a.status = 'in_review' THEN 1 END)::int AS in_review_count,
              COUNT(CASE WHEN a.status = 'interview' THEN 1 END)::int AS interview_count,
              COUNT(CASE WHEN a.status = 'approved' THEN 1 END)::int AS approved_count,
              COUNT(CASE WHEN a.status = 'rejected' THEN 1 END)::int AS rejected_count
       FROM hiring_positions p
       LEFT JOIN hiring_applications a ON a.position_id = p.id
       GROUP BY p.id, p.title, p.department, p.status
       ORDER BY total_applications DESC`
    );
    res.json({ position_analytics: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /settings/import-defaults — Reset / populate branding & default sender settings from process.env
router.post('/settings/import-defaults', async (req, res, next) => {
  try {
    const defaultEmail = process.env.DEFAULT_SENDER_EMAIL || 'careers@codeplusacademy.in';
    const defaultName = process.env.DEFAULT_SENDER_NAME || 'Code+ Academy Careers';
    const logoUrl = process.env.COMPANY_LOGO_URL || 'https://codeplusacademy.in/cpa-logo-dark.png';

    const result = await query(
      `UPDATE hiring_settings SET
        default_sender_email = $1,
        default_sender_name = $2,
        company_logo_url = $3,
        updated_at = NOW()
       WHERE id = 1 RETURNING *`,
      [defaultEmail, defaultName, logoUrl]
    );

    res.json({ message: 'Branding settings reset to system defaults from .env', settings: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
