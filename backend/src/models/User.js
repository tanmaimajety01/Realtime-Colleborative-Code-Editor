/**
 * @file models/User.js
 * @description Mongoose User schema with bcrypt hashing, RBAC, and secure
 *              refresh token storage.
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const config   = require('../config');
const { ROLES, LIMITS } = require('../utils/constants');

// ── Sub-schema: stored refresh tokens (hashed) ──────────────────────────────
const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash:  { type: String, required: true },
    createdAt:  { type: Date,   default: Date.now },
    expiresAt:  { type: Date,   required: true },
    userAgent:  { type: String, default: '' },
    ip:         { type: String, default: '' },
  },
  { _id: false }
);

// ── Main User schema ─────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    username: {
      type:      String,
      required:  [true, 'Username is required.'],
      unique:    true,
      trim:      true,
      lowercase: true,
      minlength: [LIMITS.USERNAME_MIN, `Username must be at least ${LIMITS.USERNAME_MIN} characters.`],
      maxlength: [LIMITS.USERNAME_MAX, `Username must be at most ${LIMITS.USERNAME_MAX} characters.`],
      match:     [/^[a-z0-9_-]+$/, 'Username may only contain letters, numbers, hyphens, and underscores.'],
      index:     true,
    },

    email: {
      type:      String,
      required:  [true, 'Email is required.'],
      unique:    true,
      trim:      true,
      lowercase: true,
      maxlength: [LIMITS.EMAIL_MAX, `Email must be at most ${LIMITS.EMAIL_MAX} characters.`],
      match:     [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address.'],
      index:     true,
    },

    passwordHash: {
      type:     String,
      required: [true, 'Password hash is required.'],
      select:   false, // never returned in queries by default
    },

    role: {
      type:    String,
      enum:    Object.values(ROLES),
      default: ROLES.USER,
      index:   true,
    },

    avatar: {
      type:    String,
      default: '',
      trim:    true,
    },

    // Hashed refresh tokens (max 5 active sessions)
    refreshTokens: {
      type:    [refreshTokenSchema],
      default: [],
      select:  false,
    },

    // Soft-delete / ban support
    isActive: {
      type:    Boolean,
      default: true,
      index:   true,
    },

    // Track last login timestamp
    lastLoginAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps:       true,   // adds createdAt + updatedAt
    versionKey:       false,
    toJSON:  { virtuals: true, transform: sanitize },
    toObject:{ virtuals: true, transform: sanitize },
  }
);

// ── Sanitise output – strip sensitive fields ─────────────────────────────────
function sanitize(_doc, ret) {
  delete ret.passwordHash;
  delete ret.refreshTokens;
  delete ret.__v;
  return ret;
}

// ── Compound indexes ────────────────────────────────────────────────────────
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ username: 1, isActive: 1 });

// ── Static Helpers ───────────────────────────────────────────────────────────

/**
 * Hash a plain-text password.
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt hash
 */
userSchema.statics.hashPassword = async function (plainPassword) {
  return bcrypt.hash(plainPassword, config.bcrypt.saltRounds);
};

// ── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Compare a plain-text password against this user's stored hash.
 * @param {string} plainPassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

/**
 * Add a hashed refresh token (max 5 concurrent sessions; oldest evicted).
 * @param {string} tokenHash
 * @param {Date}   expiresAt
 * @param {string} userAgent
 * @param {string} ip
 */
userSchema.methods.addRefreshToken = async function (tokenHash, expiresAt, userAgent = '', ip = '') {
  const MAX_SESSIONS = 5;
  this.refreshTokens.push({ tokenHash, expiresAt, userAgent, ip });

  // Evict oldest sessions beyond limit
  if (this.refreshTokens.length > MAX_SESSIONS) {
    this.refreshTokens = this.refreshTokens
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_SESSIONS);
  }

  // Purge expired tokens
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter((t) => t.expiresAt > now);

  await this.save();
};

/**
 * Remove a specific refresh token by its hash (logout).
 * @param {string} tokenHash
 */
userSchema.methods.removeRefreshToken = async function (tokenHash) {
  this.refreshTokens = this.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
  await this.save();
};

/**
 * Remove ALL refresh tokens (logout everywhere).
 */
userSchema.methods.removeAllRefreshTokens = async function () {
  this.refreshTokens = [];
  await this.save();
};

/**
 * Check if this user has a given role (or is admin).
 * @param {string} role
 * @returns {boolean}
 */
userSchema.methods.hasRole = function (role) {
  if (this.role === ROLES.ADMIN) return true;
  return this.role === role;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
