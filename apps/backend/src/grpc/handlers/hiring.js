const grpc = require('@grpc/grpc-js');
const { query } = require('../../config/db');
const crypto = require('crypto');
const { triggerDocumentGeneration } = require('../../services/documentTriggerService');
const { notifyCandidateStatusChange, notifyCandidateNewMessage } = require('../../services/notificationService');
const EventEmitter = require('events');

const messageEmitter = new EventEmitter();
messageEmitter.setMaxListeners(0);

/** Helper to validate and format UUID values for PostgreSQL */
function parseUuid(val) {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
}

function mapPosition(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: row.title || '',
    description: row.description || '',
    department: row.department || '',
    location: row.location || '',
    employment_type: row.employment_type || '',
    status: row.status || '',
    salary_range: row.salary_range || '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

function mapApplication(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    position_id: String(row.position_id),
    candidate_id: String(row.candidate_id),
    status: row.status || '',
    resume_url: row.resume_url || '',
    cover_letter: row.cover_letter || '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

function mapMessage(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    application_id: String(row.application_id),
    sender_id: String(row.sender_id),
    sender_role: row.sender_role || '',
    content: row.content || '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

const hiringHandlers = {
  async listPositions(call, callback) {
    try {
      const { status } = call.request;
      let sql = 'SELECT * FROM hiring_positions';
      const params = [];
      if (status) {
        sql += ' WHERE status = $1';
        params.push(status);
      }
      sql += ' ORDER BY created_at DESC';
      
      const { rows } = await query(sql, params);
      callback(null, { positions: rows.map(mapPosition) });
    } catch (err) {
      console.error('[gRPC Hiring.listPositions Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async getPosition(call, callback) {
    try {
      const { id } = call.request;
      const safeId = parseUuid(id);
      if (!safeId) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid ID' });
      
      const { rows } = await query('SELECT * FROM hiring_positions WHERE id = $1', [safeId]);
      if (rows.length === 0) return callback({ code: grpc.status.NOT_FOUND, message: 'Position not found' });
      
      callback(null, mapPosition(rows[0]));
    } catch (err) {
      console.error('[gRPC Hiring.getPosition Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async createPosition(call, callback) {
    try {
      const { title, description, department, location, employment_type, status, salary_range } = call.request;
      const { rows } = await query(
        `INSERT INTO hiring_positions (title, description, department, location, employment_type, status, salary_range)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [title, description, department, location, employment_type, status || 'open', salary_range]
      );
      callback(null, mapPosition(rows[0]));
    } catch (err) {
      console.error('[gRPC Hiring.createPosition Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async updatePosition(call, callback) {
    try {
      const { id, title, description, department, location, employment_type, status, salary_range } = call.request;
      const safeId = parseUuid(id);
      if (!safeId) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid ID' });
      
      const { rows } = await query(
        `UPDATE hiring_positions 
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             department = COALESCE($3, department),
             location = COALESCE($4, location),
             employment_type = COALESCE($5, employment_type),
             status = COALESCE($6, status),
             salary_range = COALESCE($7, salary_range),
             updated_at = NOW()
         WHERE id = $8 RETURNING *`,
        [title, description, department, location, employment_type, status, salary_range, safeId]
      );
      
      if (rows.length === 0) return callback({ code: grpc.status.NOT_FOUND, message: 'Position not found' });
      
      callback(null, mapPosition(rows[0]));
    } catch (err) {
      console.error('[gRPC Hiring.updatePosition Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async submitApplication(call, callback) {
    try {
      const { position_id, email, first_name, last_name, phone, resume_url, cover_letter } = call.request;
      const safePosId = parseUuid(position_id);
      if (!safePosId || !email) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Missing position_id or email' });
      
      // Upsert candidate
      const candRes = await query(
        `INSERT INTO candidates (email, first_name, last_name, phone)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE 
         SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone
         RETURNING id`,
        [email, first_name, last_name, phone]
      );
      const candidateId = candRes.rows[0].id;
      
      // Insert application
      const appRes = await query(
        `INSERT INTO hiring_applications (position_id, candidate_id, resume_url, cover_letter, status)
         VALUES ($1, $2, $3, $4, 'applied') RETURNING *`,
        [safePosId, candidateId, resume_url, cover_letter]
      );
      
      callback(null, mapApplication(appRes.rows[0]));
    } catch (err) {
      console.error('[gRPC Hiring.submitApplication Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async getApplicationStatus(call, callback) {
    try {
      const { application_id } = call.request;
      const safeId = parseUuid(application_id);
      if (!safeId) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid ID' });
      
      const { rows } = await query('SELECT status FROM hiring_applications WHERE id = $1', [safeId]);
      if (rows.length === 0) return callback({ code: grpc.status.NOT_FOUND, message: 'Application not found' });
      
      callback(null, { status: rows[0].status });
    } catch (err) {
      console.error('[gRPC Hiring.getApplicationStatus Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async listMyApplications(call, callback) {
    try {
      const { candidate_id } = call.request;
      const safeId = parseUuid(candidate_id);
      if (!safeId) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid candidate_id' });
      
      const { rows } = await query('SELECT * FROM hiring_applications WHERE candidate_id = $1 ORDER BY created_at DESC', [safeId]);
      callback(null, { applications: rows.map(mapApplication) });
    } catch (err) {
      console.error('[gRPC Hiring.listMyApplications Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async listAllApplications(call, callback) {
    try {
      const { status, position_id } = call.request;
      let sql = 'SELECT * FROM hiring_applications WHERE 1=1';
      const params = [];
      let paramCounter = 1;
      
      if (status) {
        sql += ` AND status = $${paramCounter++}`;
        params.push(status);
      }
      
      if (position_id) {
        const safePosId = parseUuid(position_id);
        if (safePosId) {
          sql += ` AND position_id = $${paramCounter++}`;
          params.push(safePosId);
        }
      }
      
      sql += ' ORDER BY created_at DESC';
      
      const { rows } = await query(sql, params);
      callback(null, { applications: rows.map(mapApplication) });
    } catch (err) {
      console.error('[gRPC Hiring.listAllApplications Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async updateApplicationStatus(call, callback) {
    try {
      const { application_id, status } = call.request;
      const safeId = parseUuid(application_id);
      if (!safeId || !status) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Missing ID or status' });
      
      const { rows } = await query(
        `UPDATE hiring_applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, safeId]
      );
      
      if (rows.length === 0) return callback({ code: grpc.status.NOT_FOUND, message: 'Application not found' });
      
      notifyCandidateStatusChange(safeId, status).catch(console.error);
      
      callback(null, mapApplication(rows[0]));
    } catch (err) {
      console.error('[gRPC Hiring.updateApplicationStatus Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async sendMessage(call, callback) {
    try {
      const { application_id, sender_id, sender_role, content } = call.request;
      const safeAppId = parseUuid(application_id);
      const safeSenderId = parseUuid(sender_id);
      if (!safeAppId || !safeSenderId || !content) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Missing required fields' });
      
      const { rows } = await query(
        `INSERT INTO hiring_messages (application_id, sender_id, sender_role, content)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [safeAppId, safeSenderId, sender_role, content]
      );
      
      const msg = mapMessage(rows[0]);
      messageEmitter.emit(`app:${safeAppId}`, msg);
      
      if (sender_role === 'admin') {
        notifyCandidateNewMessage(safeAppId).catch(console.error);
      }
      
      callback(null, msg);
    } catch (err) {
      console.error('[gRPC Hiring.sendMessage Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async getMessageHistory(call, callback) {
    try {
      const { application_id } = call.request;
      const safeAppId = parseUuid(application_id);
      if (!safeAppId) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid application_id' });
      
      const { rows } = await query('SELECT * FROM hiring_messages WHERE application_id = $1 ORDER BY created_at ASC', [safeAppId]);
      callback(null, { messages: rows.map(mapMessage) });
    } catch (err) {
      console.error('[gRPC Hiring.getMessageHistory Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  subscribeMessages(call) {
    const { application_id } = call.request;
    const safeAppId = parseUuid(application_id);
    if (!safeAppId) {
      call.end();
      return;
    }
    
    const channel = `app:${safeAppId}`;
    const listener = (msg) => call.write(msg);
    messageEmitter.on(channel, listener);
    
    call.on('cancelled', () => messageEmitter.off(channel, listener));
    call.on('error', () => messageEmitter.off(channel, listener));
    // Do not end the call here; it's a server streaming RPC.
  },

  async getMyTasks(call, callback) {
    try {
      const { application_id } = call.request;
      const safeAppId = parseUuid(application_id);
      if (!safeAppId) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid application_id' });
      
      const { rows } = await query('SELECT * FROM hiring_tasks WHERE application_id = $1 ORDER BY created_at ASC', [safeAppId]);
      // Note: Assuming a basic structure for tasks, map appropriately
      const tasks = rows.map(row => ({
        id: String(row.id),
        application_id: String(row.application_id),
        title: row.title || '',
        description: row.description || '',
        status: row.status || '',
        created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
      }));
      
      callback(null, { tasks });
    } catch (err) {
      console.error('[gRPC Hiring.getMyTasks Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  async approveApplication(call, callback) {
    try {
      const { application_id } = call.request;
      const safeId = parseUuid(application_id);
      if (!safeId) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Invalid ID' });
      
      const { rows } = await query(
        `UPDATE hiring_applications SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [safeId]
      );
      
      if (rows.length === 0) return callback({ code: grpc.status.NOT_FOUND, message: 'Application not found' });
      
      await triggerDocumentGeneration(safeId);
      notifyCandidateStatusChange(safeId, 'approved').catch(console.error);
      
      callback(null, mapApplication(rows[0]));
    } catch (err) {
      console.error('[gRPC Hiring.approveApplication Error]', err);
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  }
};

module.exports = {
  ...hiringHandlers,
  ListPositions: hiringHandlers.listPositions,
  GetPosition: hiringHandlers.getPosition,
  CreatePosition: hiringHandlers.createPosition,
  UpdatePosition: hiringHandlers.updatePosition,
  SubmitApplication: hiringHandlers.submitApplication,
  GetApplicationStatus: hiringHandlers.getApplicationStatus,
  ListMyApplications: hiringHandlers.listMyApplications,
  ListAllApplications: hiringHandlers.listAllApplications,
  UpdateApplicationStatus: hiringHandlers.updateApplicationStatus,
  SendMessage: hiringHandlers.sendMessage,
  GetMessageHistory: hiringHandlers.getMessageHistory,
  SubscribeMessages: hiringHandlers.subscribeMessages,
  GetMyTasks: hiringHandlers.getMyTasks,
  ApproveApplication: hiringHandlers.approveApplication,
  messageEmitter
};
