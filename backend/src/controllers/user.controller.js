/**
 * @file controllers/user.controller.js
 * @description HTTP handlers for user management endpoints.
 *
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

const userService = require('../services/user.service');
const { success, error, paginationMeta } = require('../utils/apiResponse');

// ── List Users ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by username or email
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [admin, user, viewer] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, default: createdAt }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated list of users
 *       403:
 *         description: Admin access required
 */
const listUsers = async (req, res, next) => {
  try {
    const { users, total, page, limit } = await userService.listUsers(req.query);
    return success(res, {
      data: users,
      meta: paginationMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
};

// ── Get User By ID ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user profile by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: User ObjectId
 *     responses:
 *       200:
 *         description: User object
 *       404:
 *         description: User not found
 */
const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return success(res, { data: user });
  } catch (err) {
    next(err);
  }
};

// ── Update User ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               avatar:   { type: string }
 *               password: { type: string }
 *               currentPassword: { type: string }
 *     responses:
 *       200:
 *         description: Updated user
 *       403:
 *         description: Forbidden
 */
const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.user);
    return success(res, { message: 'Profile updated.', data: user });
  } catch (err) {
    next(err);
  }
};

// ── Delete User ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete (deactivate) a user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Account deleted
 *       403:
 *         description: Forbidden
 */
const deleteUser = async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id, req.user);
    return success(res, { message: 'Account deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, getUser, updateUser, deleteUser };
