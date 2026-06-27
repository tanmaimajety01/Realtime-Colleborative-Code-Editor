/**
 * @file controllers/auth.controller.js
 * @description Thin HTTP layer for authentication – delegates to auth.service.
 *
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and authorization
 */

const authService = require('../services/auth.service');
const { success, created, error } = require('../utils/apiResponse');
const config  = require('../config');
const logger  = require('../utils/logger');

/** Cookie options for the refresh token (httpOnly, secure in prod) */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
};

// ── Register ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, example: alice }
 *               email:    { type: string, example: alice@example.com }
 *               password: { type: string, example: SecurePass1 }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email or username already exists
 *       422:
 *         description: Validation error
 */
const register = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.register(req.body);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

    return created(res, {
      message: 'Registration successful.',
      data: { user, accessToken },
    });
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: alice@example.com }
 *               password: { type: string, example: SecurePass1 }
 *     responses:
 *       200:
 *         description: Login successful – returns access token
 *       401:
 *         description: Invalid credentials
 */
const login = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.login({
      ...req.body,
      userAgent: req.headers['user-agent'] || '',
      ip:        req.ip || '',
    });

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

    return success(res, {
      message: 'Login successful.',
      data: { user, accessToken },
    });
  } catch (err) {
    next(err);
  }
};

// ── Refresh Token ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Exchange refresh token for a new access token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Invalid or expired refresh token
 */
const refresh = async (req, res, next) => {
  try {
    // Accept token from body OR httpOnly cookie
    const token = req.body.refreshToken || req.cookies?.refreshToken;

    if (!token) {
      return error(res, { message: 'Refresh token is required.', status: 400 });
    }

    const { accessToken, refreshToken: newRefreshToken, user } = await authService.refresh({
      token,
      userAgent: req.headers['user-agent'] || '',
      ip:        req.ip || '',
    });

    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

    return success(res, {
      message: 'Token refreshed.',
      data: { user, accessToken },
    });
  } catch (err) {
    next(err);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout current session (invalidate refresh token)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
const logout = async (req, res, next) => {
  try {
    const token = req.body.refreshToken || req.cookies?.refreshToken;
    const allDevices = req.body.allDevices === true;

    if (allDevices) {
      await authService.logoutAll(req.user._id);
    } else if (token) {
      await authService.logout({ userId: req.user._id, refreshToken: token });
    }

    res.clearCookie('refreshToken');
    return success(res, { message: allDevices ? 'Logged out from all devices.' : 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// ── Get Current User ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user details
 *       401:
 *         description: Unauthorized
 */
const me = async (req, res, next) => {
  try {
    // req.user is attached by verifyToken middleware
    return success(res, { data: req.user });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, me };
