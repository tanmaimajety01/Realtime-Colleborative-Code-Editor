/**
 * @file server.js
 * @description HTTP server entrypoint.
 * Starts the HTTP server FIRST, then connects to the DB in the background.
 * The server never crashes due to a DB connection failure.
 */

const http   = require('http');
const app    = require('./app');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { connectDB, disconnectDB } = require('./src/config/database');

const server = http.createServer(app);

// ── Graceful shutdown ─────────────────────────────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[Server] ${signal} received – shutting down gracefully…`);

  server.close(async () => {
    logger.info('[Server] HTTP server closed.');
    await disconnectDB();
    logger.info('[Server] Shutdown complete. Goodbye!');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('[Server] Graceful shutdown timed out – forcing exit.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Log but do NOT kill process on uncaught errors
process.on('uncaughtException', (err) => {
  logger.error(`[Server] Uncaught exception: ${err.message}`, { stack: err.stack });
});
process.on('unhandledRejection', (reason) => {
  logger.error(`[Server] Unhandled rejection: ${String(reason)}`);
});

// ── Start: HTTP server first, DB in background ────────────────────────────────

const PORT = config.server.port;

server.listen(PORT, () => {
  logger.info('══════════════════════════════════════════════════════════');
  logger.info(`  🚀  SyncCode Backend API is running!`);
  logger.info(`  📡  Port   : ${PORT}`);
  logger.info(`  🌍  Env    : ${config.env}`);
  logger.info(`  📚  Docs   : http://localhost:${PORT}/api/docs`);
  logger.info(`  ❤️   Health : http://localhost:${PORT}/api/health`);
  logger.info('══════════════════════════════════════════════════════════');
  logger.info('  ⏳  Connecting to MongoDB in background…');
  logger.info('══════════════════════════════════════════════════════════');

  // Kick off DB connection AFTER server is listening
  connectDB();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`[Server] Port ${PORT} is already in use. Change PORT in .env`);
  } else {
    logger.error(`[Server] Listen error: ${err.message}`);
  }
  process.exit(1);
});

