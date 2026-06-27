/**
 * @file logger.js
 * @description Winston logger with daily-rotate-file transport.
 * Outputs JSON in production, colorised text in development.
 */

const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, printf, errors, colorize, json } = format;

const isDev = process.env.NODE_ENV !== 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');
const LOG_DIR   = process.env.LOG_DIR   || 'logs';

// Human-readable format for development console
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
  }),
);

// JSON format for production / file transports
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

// File transports (always active)
const fileTransports = [
  new transports.DailyRotateFile({
    filename:      path.join(LOG_DIR, 'error-%DATE%.log'),
    datePattern:   'YYYY-MM-DD',
    level:         'error',
    maxFiles:      '14d',
    maxSize:       '20m',
    zippedArchive: true,
    format:        prodFormat,
  }),
  new transports.DailyRotateFile({
    filename:      path.join(LOG_DIR, 'combined-%DATE%.log'),
    datePattern:   'YYYY-MM-DD',
    maxFiles:      '14d',
    maxSize:       '50m',
    zippedArchive: true,
    format:        prodFormat,
  }),
];

const logger = createLogger({
  level: LOG_LEVEL,
  transports: [
    // Console transport (always on)
    new transports.Console({
      format: isDev ? devFormat : prodFormat,
    }),
    ...fileTransports,
  ],
  // Catch unhandled exceptions & rejections and log before crashing
  exceptionHandlers: [
    new transports.DailyRotateFile({
      filename:    path.join(LOG_DIR, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles:    '14d',
      format:      prodFormat,
    }),
  ],
  rejectionHandlers: [
    new transports.DailyRotateFile({
      filename:    path.join(LOG_DIR, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles:    '14d',
      format:      prodFormat,
    }),
  ],
});

// Attach http-level helper used by Morgan
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
