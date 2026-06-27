/**
 * @file app.js
 * @description Express application factory – no listen() here so it can be
 *              imported cleanly by tests without binding a port.
 */

require('dotenv').config();

const path        = require('path');
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const cookieParser= require('cookie-parser');
const morgan      = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const config     = require('./src/config');
const logger     = require('./src/utils/logger');
const { setupSwagger } = require('./src/config/swagger');
const apiRoutes  = require('./src/routes');
const { generalLimiter } = require('./src/middlewares/rateLimiter');
const { notFound, globalErrorHandler } = require('./src/middlewares/errorHandler');

// ── Create app ────────────────────────────────────────────────────────────────
const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:   ["'self'"],
        // Allow Swagger UI + Google Fonts + demo page inline scripts
        scriptSrc:    ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
        scriptSrcAttr:["'unsafe-inline'"], // required for onclick= handlers in demo.html
        styleSrc:     ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
        fontSrc:      ["'self'", 'fonts.gstatic.com'],
        imgSrc:       ["'self'", 'data:', 'ui-avatars.com', 'https:'],
        connectSrc:   ["'self'"],
      },
    },
  })
);

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin) return cb(null, true);
      if (config.cors.origins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: Origin "${origin}" is not allowed.`));
    },
    credentials:         true, // allow cookies
    methods:             ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders:      ['Content-Type', 'Authorization'],
    exposedHeaders:      ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    optionsSuccessStatus: 200,
  })
);

// ── Trust proxy (needed for correct req.ip behind nginx/load balancer) ─────────
if (config.isProd) {
  app.set('trust proxy', 1);
}

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Compression ────────────────────────────────────────────────────────────────
app.use(compression());

// ── NoSQL injection prevention ────────────────────────────────────────────────
app.use(
  mongoSanitize({
    replaceWith:     '_',
    onSanitizeError: (req, _res) => {
      logger.warn(`[Security] Mongo-sanitize triggered on ${req.method} ${req.path}`);
    },
  })
);

// ── HTTP request logging ──────────────────────────────────────────────────────
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: logger.stream,
      // Skip health-check noise in prod logs
      skip: (_req, res) => res.statusCode < 400,
    })
  );
}

// ── General API rate limiter ───────────────────────────────────────────────────
app.use('/api', generalLimiter);

// ── Swagger docs (before routes so /api/docs doesn't hit the auth guard) ──────
setupSwagger(app);

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Static files (demo UI) ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// shortcut: GET /demo → serves demo.html
app.get('/demo', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

// ── Root endpoint ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name:    'SyncCode Backend API',
    version: '1.0.0',
    demo:    '/demo',
    docs:    '/api/docs',
    health:  '/api/health',
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use(notFound);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(globalErrorHandler);

module.exports = app;
