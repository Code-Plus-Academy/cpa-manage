const { pool } = require('../../config/db');
const grpc = require('@grpc/grpc-js');
const EventEmitter = require('events');
const documentTriggerService = require('../../services/documentTriggerService');
const notificationService = require('../../services/notificationService');

const messageEmitter = new EventEmitter();
messageEmitter.setMaxListeners(0);

function mapPosition(row) {
  if (!row) return null;
  const statusMap = {
    DRAFT: 1, draft: 1,
    UPCOMING: 2, upcoming: 2,
    OPEN: 3, open: 3,
    CLOSED: 4, closed: 4,
  };
  return {
    id: row.id,
    title: row.title || '',
    department: row.department || '',
    type: row.type || 'intern',
    status: typeof row.status === 'number' ? row.status : (statusMap[row.status] || 3),
    description: row.description || '',
    openings: row.openings || 1,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    location: row.location || 'remote',
    requirements: row.requirements || '',
    responsibilities: row.responsibilities || '',
    salary_range: row.salary_range || '',
    application_deadline: row.application_deadline ? new Date(row.application_deadline).toISOString() : '',
    auto_response_enabled: row.auto_response_enabled !== false,
    custom_form_fields_json: JSON.stringify(row.custom_form_fields || [])
  };
}

function mapApplication(row) {
  if (!row) return null;
  const statusMap = {
    APPLIED: 1, applied: 1,
    IN_REVIEW: 2, in_review: 2,
    INTERVIEW: 3, interview: 3,
    APPROVED: 4, approved: 4,
    REJECTED: 5, rejected: 5,
  };
  return {
    id: row.id,
    candidate_id: row.candidate_id || '',
    position_id: row.position_id || '',
    status: typeof row.status === 'number' ? row.status : (statusMap[row.status] || 1),
    resume_url: row.resume_url || '',
    applied_at: row.applied_at ? new Date(row.applied_at).toISOString() : '',
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
    notes: row.notes || '',
    candidate_name: row.candidate_name || row.name || '',
    candidate_email: row.candidate_email || row.email || '',
    candidate_phone: row.candidate_phone || row.phone || '',
    assigned_owner_id: row.assigned_owner_id || '',
    rejection_reason: row.rejection_reason || '',
    rejection_notes: row.rejection_notes || '',
    offer_status: row.offer_status || 'none'
  };
}

function mapMessage(row) {
  if (!row) return null;
  const roleMap = { ADMIN: 1, admin: 1, CANDIDATE: 2, candidate: 2 };
  return {
    id: row.id,
    application_id: row.application_id,
    sender_role: typeof row.sender_role === 'number' ? row.sender_role : (roleMap[row.sender_role] || 2),
    sender_id: row.sender_id || '',
    body: row.body || '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

async function listPositions(call, callback) {
  try {
    const { status_filter } = call.request;
    let sql = 'SELECT * FROM hiring_positions ORDER BY created_at DESC';
    let params = [];

    if (status_filter && status_filter !== 0) {
      const statusNames = ['', 'draft', 'upcoming', 'open', 'closed'];
      sql = 'SELECT * FROM hiring_positions WHERE status = $1 ORDER BY created_at DESC';
      params = [statusNames[status_filter] || 'open'];
    }

    const { rows } = await pool.query(sql, params);
    callback(null, { positions: rows.map(mapPosition) });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function getPosition(call, callback) {
  try {
    const { id } = call.request;
    const { rows } = await pool.query('SELECT * FROM hiring_positions WHERE id = $1', [id]);
    if (rows.length === 0) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Position not found' });
    }
    callback(null, mapPosition(rows[0]));
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function createPosition(call, callback) {
  try {
    const { title, department, type, description, openings, location } = call.request;
    const { rows } = await pool.query(
      `INSERT INTO hiring_positions (title, department, type, status, description, openings, location)
       VALUES ($1, $2, $3, 'open', $4, $5, $6) RETURNING *`,
      [title, department || 'Engineering', type || 'intern', description || '', openings || 1, location || 'remote']
    );
    callback(null, mapPosition(rows[0]));
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function updatePosition(call, callback) {
  try {
    const { id, title, department, type, description, openings } = call.request;
    const { rows } = await pool.query(
      `UPDATE hiring_positions SET
        title = COALESCE(NULLIF($1, ''), title),
        department = COALESCE(NULLIF($2, ''), department),
        type = COALESCE(NULLIF($3, ''), type),
        description = COALESCE(NULLIF($4, ''), description),
        openings = COALESCE(NULLIF($5, 0), openings),
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [title, department, type, description, openings, id]
    );
    if (rows.length === 0) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Position not found' });
    }
    callback(null, mapPosition(rows[0]));
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function submitApplication(call, callback) {
  try {
    const { candidate_id, position_id, resume_url, candidate_name, candidate_email, candidate_phone } = call.request;

    if (!position_id || !resume_url || !candidate_email) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Missing required application fields' });
    }

    const candRes = await pool.query(
      `INSERT INTO hiring_candidates (name, email, phone)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = COALESCE(EXCLUDED.phone, hiring_candidates.phone)
       RETURNING id, name, email, phone`,
      [candidate_name || 'Applicant', candidate_email.toLowerCase().trim(), candidate_phone || null]
    );
    const candidate = candRes.rows[0];

    const appRes = await pool.query(
      `INSERT INTO hiring_applications (candidate_id, position_id, resume_url, status)
       VALUES ($1, $2, $3, 'applied')
       RETURNING *`,
      [candidate.id, position_id, resume_url]
    );

    const app = appRes.rows[0];
    app.candidate_name = candidate.name;
    app.candidate_email = candidate.email;
    app.candidate_phone = candidate.phone;

    callback(null, mapApplication(app));
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function getApplicationStatus(call, callback) {
  try {
    const { application_id } = call.request;
    const { rows } = await pool.query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email, c.phone AS candidate_phone
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id = c.id
       WHERE a.id = $1`,
      [application_id]
    );

    if (rows.length === 0) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Application not found' });
    }

    callback(null, mapApplication(rows[0]));
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function listMyApplications(call, callback) {
  try {
    const { candidate_id } = call.request;
    const { rows } = await pool.query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id = c.id
       WHERE a.candidate_id = $1 OR c.email = $1
       ORDER BY a.applied_at DESC`,
      [candidate_id]
    );

    callback(null, { applications: rows.map(mapApplication) });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function listAllApplications(call, callback) {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id = c.id
       ORDER BY a.applied_at DESC`
    );

    callback(null, { applications: rows.map(mapApplication) });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function updateApplicationStatus(call, callback) {
  try {
    const { application_id, status, notes } = call.request;
    const statusNames = ['', 'applied', 'in_review', 'interview', 'approved', 'rejected'];
    const statusStr = typeof status === 'number' ? (statusNames[status] || 'applied') : status;

    const { rows } = await pool.query(
      `UPDATE hiring_applications
       SET status = COALESCE($1, status), notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [statusStr, notes, application_id]
    );

    if (rows.length === 0) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Application not found' });
    }

    callback(null, mapApplication(rows[0]));
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function sendMessage(call, callback) {
  try {
    const { application_id, sender_role, sender_id, body } = call.request;
    const roleMap = { 1: 'admin', 2: 'candidate' };
    const roleStr = typeof sender_role === 'number' ? (roleMap[sender_role] || 'candidate') : sender_role;

    const { rows } = await pool.query(
      `INSERT INTO hiring_messages (application_id, sender_role, sender_id, body)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [application_id, roleStr, sender_id, body]
    );

    const msg = mapMessage(rows[0]);
    messageEmitter.emit(`app:${application_id}`, msg);

    callback(null, msg);
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function getMessageHistory(call, callback) {
  try {
    const { application_id } = call.request;
    const { rows } = await pool.query(
      'SELECT * FROM hiring_messages WHERE application_id = $1 ORDER BY created_at ASC',
      [application_id]
    );

    callback(null, { messages: rows.map(mapMessage) });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

function subscribeMessages(call) {
  const { application_id } = call.request;
  const channel = `app:${application_id}`;

  const listener = (msg) => {
    try {
      call.write(msg);
    } catch (e) {
      console.error('[gRPC Stream Error]', e.message);
    }
  };

  messageEmitter.on(channel, listener);
  call.on('cancelled', () => messageEmitter.off(channel, listener));
  call.on('end', () => messageEmitter.off(channel, listener));
  call.on('error', () => messageEmitter.off(channel, listener));
}

async function getMyTasks(call, callback) {
  try {
    const { application_id } = call.request;
    const { rows } = await pool.query(
      'SELECT * FROM hiring_intern_tasks WHERE application_id = $1 ORDER BY created_at ASC',
      [application_id]
    );

    callback(null, {
      tasks: rows.map((r) => ({
        id: r.id,
        application_id: r.application_id,
        title: r.title,
        status: r.status,
        due_date: r.due_date ? new Date(r.due_date).toISOString() : '',
        progress: r.progress || 0,
      })),
    });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function approveApplication(call, callback) {
  try {
    const { application_id } = call.request;

    const { rows } = await pool.query(
      `UPDATE hiring_applications SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [application_id]
    );

    if (rows.length === 0) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Application not found' });
    }

    const docStatus = await documentTriggerService.triggerDocumentGeneration(application_id);

    callback(null, {
      application: mapApplication(rows[0]),
      document_trigger_status: docStatus,
      offer_preview_html: `<div>Offer Letter Preview for ${application_id}</div>`
    });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

module.exports = {
  listPositions,
  getPosition,
  createPosition,
  updatePosition,
  submitApplication,
  getApplicationStatus,
  listMyApplications,
  listAllApplications,
  updateApplicationStatus,
  sendMessage,
  getMessageHistory,
  subscribeMessages,
  getMyTasks,
  approveApplication,
  messageEmitter,
};
