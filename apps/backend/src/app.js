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

const app = express();
app.set('trust proxy', 1);

// ─── Security ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowedPatterns = [
      /^http:\/\/localhost:\d+$/,
      /^https:\/\/manage\.codeplusacademy\.in$/,
      /^https:\/\/.*\.codeplusacademy\.in$/,
      /^https:\/\/.*\.pages\.dev$/,
    ];
    if (allowedPatterns.some(p => p.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(helmet());

// ─── Logging & Parsing ─────────────────────────────────────────────────────────
app.use(requestLogger);
app.use(express.json());
app.use(cookieParser());

// ─── Public routes ─────────────────────────────────────────────────────────────
app.use('/healthz', healthzRoutes);

// ─── Auth routes (login/logout BEFORE requireAdminAuth) ────────────────────────
app.use('/admin/auth', authRoutes);

// ─── Admin auth gate (everything under /admin/* except /admin/auth) ────────────
app.use('/admin', requireAdminAuth);

// ─── Admin routes ──────────────────────────────────────────────────────────────
app.use('/admin/cases', casesRoutes);
app.use('/admin/admins', adminsRoutes);
app.use('/admin/users', usersRoutes);
app.use('/admin/claims/institution', institutionClaimsRoutes);

// ─── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
});

// ─── Error Handler (MUST be last) ──────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
