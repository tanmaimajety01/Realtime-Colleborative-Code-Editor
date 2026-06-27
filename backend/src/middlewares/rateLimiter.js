/**
 * @file middlewares/rateLimiter.js
 * @description express-rate-limit configurations for general and auth endpoints.
 */

const rateLimit = require('express-rate-limit');
const config    = require('../config');
const { error } = require('../utils/apiResponse');

/**
 * Standard rate-limit handler that returns a JSON error (not HTML).
 */
const jsonHandler = (_req, res) =>
  error(res, {
    message: 'Too many requests – please slow down and try again later.',
    status:  429,
  });

/**
 * General API rate limiter: 100 req / 15 minutes.
 * Applied to all /api/* routes.
 */
const generalLimiter = rateLimit({
  windowMs:        config.rateLimit.windowMs,
  max:             config.rateLimit.max,
  standardHeaders: true,   // Return `RateLimit-*` headers
  legacyHeaders:   false,
  handler:         jsonHandler,
  // Use IP address by default; set `trustProxy: true` if behind nginx/load balancer
  keyGenerator:    (req) => req.ip,
});

/**
 * Strict auth rate limiter: 10 req / 15 minutes.
 * Applied only to /api/auth/login and /api/auth/register.
 */
const authLimiter = rateLimit({
  windowMs:        config.rateLimit.windowMs,
  max:             config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         jsonHandler,
  skipSuccessfulRequests: false, // count ALL requests (including 200s for auth)
  keyGenerator:    (req) => req.ip,
});

/**
 * Refresh token limiter: 20 req / 15 minutes per IP.
 */
const refreshLimiter = rateLimit({
  windowMs:        config.rateLimit.windowMs,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         jsonHandler,
  keyGenerator:    (req) => req.ip,
});

module.exports = { generalLimiter, authLimiter, refreshLimiter };
