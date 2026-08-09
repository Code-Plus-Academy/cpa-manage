/**
 * Express app assembly — middleware order per BACKEND_SPEC §2.1.
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const requireAdminAuth = require('./middleware/requireAdminAuth');
const authRoutes = require('./routes/auth');
const healthzRoutes = require('./routes/healthz');
const casesRoutes = require('./routes/cases');
const adminsRoutes = require('./routes/admins');
const usersRoutes = require('./routes/users');
const institutionClaimsRoutes = require('./routes/institutionClaims');
const emailRoutes = require('./routes/email');
const systemStatusRoutes = require('./routes/systemStatus');
const auditLogRoutes = require('./routes/auditLog');
const webhookRoutes = require('./routes/webhook');
const hiringRoutes = require('./routes/hiring');

const app = express();
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,X-Admin-Token,x-admin-token');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(helmet());

// ─── Logging & Parsing ─────────────────────────────────────────────────────────
app.use(requestLogger);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// ─── Public routes ─────────────────────────────────────────────────────────────
app.use('/healthz', healthzRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/hiring', hiringRoutes);

// ─── Auth routes (login/logout BEFORE requireAdminAuth) ────────────────────────
app.use('/admin/auth', authRoutes);

// ─── Admin auth gate (everything under /admin/* except /admin/auth) ────────────
app.use('/admin', requireAdminAuth);

// ─── Admin routes ──────────────────────────────────────────────────────────────
app.use('/admin/cases', casesRoutes);
app.use('/admin/admins', adminsRoutes);
app.use('/admin/users', usersRoutes);
app.use('/admin/claims/institution', institutionClaimsRoutes);
app.use('/admin/institution-claims', institutionClaimsRoutes);
app.use('/admin/audit-log', auditLogRoutes);
app.use('/admin/email', emailRoutes);
app.use('/admin/system-status', systemStatusRoutes);
app.use('/admin/hiring', hiringRoutes);

// ─── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
});

// ─── Error Handler (MUST be last) ──────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
