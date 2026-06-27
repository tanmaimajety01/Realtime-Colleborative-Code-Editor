/**
 * @file config/database.js
 * @description Mongoose connection with background retry, health-check helper,
 *              and graceful shutdown. The HTTP server starts BEFORE this
 *              resolves — DB failure never crashes the process.
 */

const mongoose = require('mongoose');
const config   = require('./index');
const logger   = require('../utils/logger');

// Exponential backoff caps (ms)
const INITIAL_DELAY_MS = 3_000;
const MAX_DELAY_MS     = 30_000;

let _retryTimer = null;
let _isConnecting = false;

const MONGOOSE_OPTS = {
  dbName:                   config.db.name,
  serverSelectionTimeoutMS: 8_000,
  socketTimeoutMS:          45_000,
  maxPoolSize:              20,
  minPoolSize:              2,
  heartbeatFrequencyMS:     10_000,
};

/**
 * Attempt one connection. Returns true on success, false on failure.
 * @private
 */
async function _tryConnect() {
  try {
    if (mongoose.connection.readyState === 1) return true; // already connected
    await mongoose.connect(config.db.uri, MONGOOSE_OPTS);
    logger.info(`[DB] ✅ Connected to MongoDB  (db: ${config.db.name})`);
    return true;
  } catch (err) {
    logger.error(`[DB] Connection failed: ${err.message}`);
    return false;
  }
}

/**
 * Start a background retry loop with exponential backoff.
 * Never throws, never exits the process.
 * @param {number} delay - Current backoff delay in ms
 * @private
 */
function _scheduleRetry(delay = INITIAL_DELAY_MS) {
  if (_retryTimer) return; // already scheduled
  _retryTimer = setTimeout(async () => {
    _retryTimer = null;
    const ok = await _tryConnect();
    if (!ok) {
      const next = Math.min(delay * 2, MAX_DELAY_MS);
      logger.info(`[DB] Retrying in ${next / 1000}s…`);
      _scheduleRetry(next);
    }
  }, delay);
}

/**
 * Initiate the DB connection in the background. Resolves immediately.
 * The server can start before MongoDB is ready.
 */
function connectDB() {
  if (_isConnecting) return;
  _isConnecting = true;

  _tryConnect().then((ok) => {
    if (!ok) _scheduleRetry(INITIAL_DELAY_MS);
  });
}

// ── Mongoose event listeners ─────────────────────────────────────────────────

mongoose.connection.on('disconnected', () => {
  logger.warn('[DB] MongoDB disconnected — scheduling reconnect…');
  _scheduleRetry(INITIAL_DELAY_MS);
});

mongoose.connection.on('reconnected', () => {
  logger.info('[DB] ✅ MongoDB reconnected.');
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
});

mongoose.connection.on('error', (err) => {
  logger.error(`[DB] Mongoose error: ${err.message}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

/**
 * Close the Mongoose connection gracefully (called by server.js on SIGTERM).
 */
async function disconnectDB() {
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
  try {
    await mongoose.connection.close();
    logger.info('[DB] MongoDB connection closed.');
  } catch (err) {
    logger.error(`[DB] Error closing connection: ${err.message}`);
  }
}

/**
 * Returns true if Mongoose is currently connected.
 */
function isConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, disconnectDB, isConnected };

