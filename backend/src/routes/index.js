/**
 * @file routes/index.js
 * @description Central route registry. Mounts all sub-routers and exposes
 *              a health-check endpoint.
 */

const router = require('express').Router();
const { isConnected } = require('../config/database');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const roomRoutes = require('./room.routes');

// ── Health Check ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Server health check
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *       503:
 *         description: Database unreachable
 */
router.get('/health', (_req, res) => {
  const dbOk  = isConnected();
  const status = dbOk ? 200 : 503;
  res.status(status).json({
    success:   dbOk,
    status:    dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
    services: {
      database: dbOk ? 'connected' : 'disconnected – retrying in background',
    },
    message: dbOk
      ? 'All systems operational.'
      : 'MongoDB is not connected. Auth/Room endpoints will return 503 until DB is available. ' +
        'Set MONGODB_URI in backend/.env to your MongoDB connection string.',
  });
});


// ── Sub-routers ───────────────────────────────────────────────────────────────

/**
 * Guard: return 503 with a helpful message if MongoDB isn't connected yet.
 * The health endpoint and docs remain accessible regardless.
 */
function requireDB(req, res, next) {
  if (isConnected()) return next();
  return res.status(503).json({
    success: false,
    message:
      'Database not yet connected. The server is running but MongoDB is unavailable. ' +
      'Please set a valid MONGODB_URI in backend/.env and restart, or wait for the background retry.',
    docs: `http://localhost:${process.env.PORT || 5003}/api/docs`,
  });
}

router.use('/auth',  requireDB, authRoutes);
router.use('/users', requireDB, userRoutes);
router.use('/rooms', requireDB, roomRoutes);


module.exports = router;
