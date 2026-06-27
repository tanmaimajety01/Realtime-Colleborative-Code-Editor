/**
 * @file routes/auth.routes.js
 * @description Express router for /api/auth endpoints.
 */

const router = require('express').Router();

const authController  = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const validate        = require('../middlewares/validate');
const { authLimiter, refreshLimiter } = require('../middlewares/rateLimiter');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} = require('../validators/auth.validator');

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  authController.register,
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.login,
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  refreshLimiter,
  validate(refreshSchema, 'body'),
  authController.refresh,
);

// POST /api/auth/logout  (requires valid access token)
router.post(
  '/logout',
  verifyToken,
  validate(logoutSchema),
  authController.logout,
);

// GET /api/auth/me  (requires valid access token)
router.get('/me', verifyToken, authController.me);

module.exports = router;
