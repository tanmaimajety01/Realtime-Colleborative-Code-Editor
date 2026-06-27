/**
 * @file middlewares/auth.middleware.js
 * @description JWT verification middleware + role-based access control.
 */

const authService = require('../services/auth.service');
const User        = require('../models/User');
const { MESSAGES, ROLES } = require('../utils/constants');
const { error }   = require('../utils/apiResponse');
const logger      = require('../utils/logger');

/**
 * Extract the Bearer token from the Authorization header or cookies.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  // Also support httpOnly cookie (set during login)
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
}

/**
 * Middleware: verify JWT access token and attach `req.user`.
 * Returns 401 if token is missing/invalid/expired.
 */
const verifyToken = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return error(res, { message: MESSAGES.UNAUTHORIZED, status: 401 });
  }

  try {
    const payload = authService.verifyAccessToken(token);

    // Fetch user from DB to ensure they're still active
    const user = await User.findOne({ _id: payload.sub, isActive: true }).lean();
    if (!user) {
      return error(res, { message: MESSAGES.UNAUTHORIZED, status: 401 });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.debug(`[Auth] Token verification failed: ${err.message}`);

    if (err.name === 'TokenExpiredError') {
      return error(res, { message: 'Access token expired – please refresh.', status: 401 });
    }

    return error(res, { message: MESSAGES.UNAUTHORIZED, status: 401 });
  }
};

/**
 * Middleware factory: require a specific role (or admin override).
 * Must be used AFTER verifyToken.
 * @param {...string} roles - One or more roles that may access the route.
 * @returns {import('express').RequestHandler}
 *
 * @example
 *   router.delete('/:id', verifyToken, requireRole('admin'), handler);
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return error(res, { message: MESSAGES.UNAUTHORIZED, status: 401 });
  }

  // Admin bypasses all role checks
  if (req.user.role === ROLES.ADMIN) return next();

  if (!roles.includes(req.user.role)) {
    return error(res, { message: MESSAGES.FORBIDDEN, status: 403 });
  }

  next();
};

/**
 * Optional auth: attach req.user if a valid token is present,
 * but don't block the request if not.
 */
const optionalAuth = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = authService.verifyAccessToken(token);
    const user    = await User.findOne({ _id: payload.sub, isActive: true }).lean();
    if (user) req.user = user;
  } catch {
    // silently ignore invalid tokens for optional routes
  }

  next();
};

module.exports = { verifyToken, requireRole, optionalAuth };
