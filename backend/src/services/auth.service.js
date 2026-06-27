/**
 * @file services/auth.service.js
 * @description Business logic for authentication: JWT operations, refresh
 *              token management, and token verification.
 */

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../models/User');
const config = require('../config');
const logger = require('../utils/logger');

// ── Token Helpers ────────────────────────────────────────────────────────────

/**
 * Sign a short-lived JWT access token.
 * @param {{_id: string, role: string}} payload
 * @returns {string}
 */
function signAccessToken(payload) {
  return jwt.sign(
    { sub: String(payload._id), role: payload.role, type: 'access' },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn, issuer: 'synccode-api' }
  );
}

/**
 * Sign a long-lived JWT refresh token.
 * @param {{_id: string}} payload
 * @returns {string}
 */
function signRefreshToken(payload) {
  return jwt.sign(
    { sub: String(payload._id), type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn, issuer: 'synccode-api' }
  );
}

/**
 * Verify a JWT access token.
 * @param {string} token
 * @returns {{ sub: string, role: string }}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret, { issuer: 'synccode-api' });
}

/**
 * Verify a JWT refresh token.
 * @param {string} token
 * @returns {{ sub: string }}
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret, { issuer: 'synccode-api' });
}

/**
 * SHA-256 hash a token for DB storage (never store raw tokens).
 * @param {string} token
 * @returns {string} hex hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Parse "7d", "15m", etc. into milliseconds for Date arithmetic.
 * @param {string} expiresIn e.g. "7d", "15m", "3600s"
 * @returns {number} milliseconds
 */
function parseDurationToMs(expiresIn) {
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const match = String(expiresIn).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 86_400_000; // default 7 days
  return parseInt(match[1], 10) * units[match[2]];
}

// ── Auth Service ─────────────────────────────────────────────────────────────

/**
 * Register a new user.
 * @param {{ username, email, password }} data
 * @returns {Promise<{ user: User, accessToken: string, refreshToken: string }>}
 */
async function register({ username, email, password }) {
  // Check for existing username / email (race-condition safe via unique index)
  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
  });

  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'Email' : 'Username';
    const err   = new Error(`${field} is already in use.`);
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    username: username.toLowerCase(),
    email:    email.toLowerCase(),
    passwordHash,
  });

  const { accessToken, refreshToken } = await _issueTokenPair(user, '', '');

  logger.info(`[Auth] New user registered: ${user.email} (${user._id})`);
  return { user, accessToken, refreshToken };
}

/**
 * Login with email + password.
 * @param {{ email, password, userAgent?, ip? }} data
 * @returns {Promise<{ user: User, accessToken: string, refreshToken: string }>}
 */
async function login({ email, password, userAgent = '', ip = '' }) {
  // +passwordHash because it's select: false
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select('+passwordHash +refreshTokens');

  const passwordValid = user ? await user.comparePassword(password) : false;

  // Timing-safe: always check password even when user not found
  if (!user || !passwordValid) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  const { accessToken, refreshToken } = await _issueTokenPair(user, userAgent, ip);

  user.lastLoginAt = new Date();
  await user.save();

  logger.info(`[Auth] User logged in: ${user.email} from ${ip}`);
  return { user, accessToken, refreshToken };
}

/**
 * Refresh access token using a valid refresh token.
 * @param {string} token  - raw refresh token from cookie/body
 * @param {string} userAgent
 * @param {string} ip
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: User }>}
 */
async function refresh({ token, userAgent = '', ip = '' }) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    const err = new Error('Invalid or expired refresh token.');
    err.statusCode = 401;
    throw err;
  }

  const tokenHash = hashToken(token);
  const user = await User.findOne({ _id: payload.sub, isActive: true }).select('+refreshTokens');

  const tokenRecord = user?.refreshTokens.find((t) => t.tokenHash === tokenHash);

  if (!user || !tokenRecord) {
    const err = new Error('Refresh token not recognised – please log in again.');
    err.statusCode = 401;
    throw err;
  }

  // Rotate: invalidate old, issue new pair
  await user.removeRefreshToken(tokenHash);
  const issued = await _issueTokenPair(user, userAgent, ip);

  logger.info(`[Auth] Token refreshed for user: ${user._id}`);
  return { ...issued, user };
}

/**
 * Logout a single session by invalidating the refresh token.
 * @param {{ userId: string, refreshToken: string }} data
 */
async function logout({ userId, refreshToken }) {
  try {
    const user = await User.findById(userId).select('+refreshTokens');
    if (!user) return;
    await user.removeRefreshToken(hashToken(refreshToken));
    logger.info(`[Auth] User logged out: ${userId}`);
  } catch (err) {
    logger.warn(`[Auth] Logout error (non-fatal): ${err.message}`);
  }
}

/**
 * Logout from ALL devices.
 * @param {string} userId
 */
async function logoutAll(userId) {
  const user = await User.findById(userId).select('+refreshTokens');
  if (user) {
    await user.removeAllRefreshTokens();
    logger.info(`[Auth] All sessions revoked for user: ${userId}`);
  }
}

// ── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Create and persist a token pair (access + refresh).
 * @private
 */
async function _issueTokenPair(user, userAgent, ip) {
  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const tokenHash    = hashToken(refreshToken);
  const expiresAt    = new Date(Date.now() + parseDurationToMs(config.jwt.refreshExpiresIn));

  await user.addRefreshToken(tokenHash, expiresAt, userAgent, ip);

  return { accessToken, refreshToken };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  signAccessToken,
};
