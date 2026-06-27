/**
 * @file services/user.service.js
 * @description Business logic for user CRUD operations.
 */

const User   = require('../models/User');
const { PAGINATION, ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Retrieve a paginated, filtered list of users.
 * @param {object} opts
 * @param {number} opts.page
 * @param {number} opts.limit
 * @param {string} opts.search  - Match against username or email
 * @param {string} opts.role    - Filter by role
 * @param {string} opts.sortBy  - Field to sort by (default: createdAt)
 * @param {string} opts.sortDir - asc | desc
 * @returns {Promise<{ users: User[], total: number }>}
 */
async function listUsers({ page, limit, search, role, sortBy = 'createdAt', sortDir = 'desc' } = {}) {
  const p = Math.max(1, parseInt(page, 10)  || PAGINATION.DEFAULT_PAGE);
  const l = Math.min(
    Math.max(1, parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT),
    PAGINATION.MAX_LIMIT
  );
  const skip = (p - 1) * l;

  const filter = { isActive: true };

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or  = [{ username: regex }, { email: regex }];
  }

  if (role && Object.values(ROLES).includes(role)) {
    filter.role = role;
  }

  const sort = { [sortBy]: sortDir === 'asc' ? 1 : -1 };

  const [users, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(l).lean(),
    User.countDocuments(filter),
  ]);

  return { users, total, page: p, limit: l };
}

/**
 * Fetch a single user by ID.
 * @param {string} userId
 * @returns {Promise<User>}
 */
async function getUserById(userId) {
  const user = await User.findOne({ _id: userId, isActive: true }).lean();
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

/**
 * Update a user's profile fields.
 * Only allowed fields are applied (allowlist approach).
 * @param {string} userId
 * @param {object} updates
 * @param {object} requestingUser - The user making the request
 * @returns {Promise<User>}
 */
async function updateUser(userId, updates, requestingUser) {
  const user = await User.findOne({ _id: userId, isActive: true });
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  // Non-admins cannot update other users
  if (String(userId) !== String(requestingUser._id) && requestingUser.role !== ROLES.ADMIN) {
    const err = new Error('Forbidden – you can only update your own profile.');
    err.statusCode = 403;
    throw err;
  }

  // Allowlisted fields for self-update
  const allowedFields = ['username', 'avatar'];

  // Admins may also change roles
  if (requestingUser.role === ROLES.ADMIN) {
    allowedFields.push('role', 'isActive');
  }

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === 'username') {
        updates[field] = String(updates[field]).toLowerCase().trim();
      }
      user[field] = updates[field];
    }
  }

  // Handle password change (requires currentPassword confirmation)
  if (updates.password) {
    if (!updates.currentPassword) {
      const err = new Error('Current password is required to set a new password.');
      err.statusCode = 400;
      throw err;
    }
    const userWithPw = await User.findById(userId).select('+passwordHash');
    const match = await userWithPw.comparePassword(updates.currentPassword);
    if (!match) {
      const err = new Error('Current password is incorrect.');
      err.statusCode = 401;
      throw err;
    }
    user.passwordHash = await User.hashPassword(updates.password);
  }

  const saved = await user.save();
  logger.info(`[User] Updated user ${userId} by ${requestingUser._id}`);
  return saved.toJSON();
}

/**
 * Soft-delete a user account.
 * @param {string} userId
 * @param {object} requestingUser
 */
async function deleteUser(userId, requestingUser) {
  const user = await User.findOne({ _id: userId, isActive: true });
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  const isSelf  = String(userId) === String(requestingUser._id);
  const isAdmin = requestingUser.role === ROLES.ADMIN;

  if (!isSelf && !isAdmin) {
    const err = new Error('Forbidden – you do not have permission to delete this account.');
    err.statusCode = 403;
    throw err;
  }

  user.isActive = false;
  await user.save();
  logger.warn(`[User] User soft-deleted: ${userId} by ${requestingUser._id}`);
}

module.exports = { listUsers, getUserById, updateUser, deleteUser };
