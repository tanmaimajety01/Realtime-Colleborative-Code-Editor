/**
 * @file middlewares/errorHandler.js
 * @description Centralised Express global error handler.
 * Must have 4 parameters (err, req, res, next) to be recognised by Express.
 */

const logger = require('../utils/logger');
const { error } = require('../utils/apiResponse');

/**
 * 404 handler – mount BEFORE the global error handler but AFTER all routes.
 */
const notFound = (req, res, _next) => {
  error(res, {
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    status:  404,
  });
};

/**
 * Global async-aware error handler.
 * Handles Mongoose validation/cast errors, JWT errors, and generic errors.
 * @param {Error} err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
const globalErrorHandler = (err, req, res, _next) => {
  // Log the full error internally
  logger.error(`[Error] ${req.method} ${req.originalUrl} → ${err.message}`, {
    stack:      err.stack,
    statusCode: err.statusCode,
    body:       req.body,
    userId:     req.user?._id,
  });

  // ── Mongoose Validation Error ──────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return error(res, { message: 'Validation failed.', status: 422, errors });
  }

  // ── Mongoose Duplicate Key ─────────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return error(res, {
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} is already in use.`,
      status:  409,
    });
  }

  // ── Mongoose CastError (invalid ObjectId) ─────────────────────────────────
  if (err.name === 'CastError') {
    return error(res, { message: `Invalid ${err.path}: ${err.value}`, status: 400 });
  }

  // ── JSON Parse Error ───────────────────────────────────────────────────────
  if (err.type === 'entity.parse.failed') {
    return error(res, { message: 'Invalid JSON in request body.', status: 400 });
  }

  // ── JWT Errors ─────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return error(res, { message: 'Invalid token.', status: 401 });
  }
  if (err.name === 'TokenExpiredError') {
    return error(res, { message: 'Token expired.', status: 401 });
  }

  // ── Custom App Errors (err.statusCode set by services) ────────────────────
  if (err.statusCode && err.statusCode < 500) {
    return error(res, { message: err.message, status: err.statusCode });
  }

  // ── Payload Too Large ──────────────────────────────────────────────────────
  if (err.status === 413 || err.type === 'entity.too.large') {
    return error(res, { message: 'Request payload too large.', status: 413 });
  }

  // ── Default: 500 Internal Server Error ────────────────────────────────────
  const isProd = process.env.NODE_ENV === 'production';
  return error(res, {
    message: isProd ? 'Internal server error – please try again.' : err.message,
    status:  500,
  });
};

module.exports = { notFound, globalErrorHandler };
