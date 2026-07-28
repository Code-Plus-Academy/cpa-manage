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

// ─── Admin routes (populated in later phases) ──────────────────────────────────
// app.use('/admin/cases', requirePermission.any([...]), ticketRoutes);
// app.use('/admin/admins', requirePermission.rootOnly, adminRoutes);

// ─── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
});

// ─── Error Handler (MUST be last) ──────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
