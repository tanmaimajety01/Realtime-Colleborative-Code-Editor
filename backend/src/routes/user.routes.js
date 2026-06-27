/**
 * @file routes/user.routes.js
 * @description Express router for /api/users endpoints.
 */

const router = require('express').Router();

const userController    = require('../controllers/user.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const validate          = require('../middlewares/validate');
const { updateUserSchema, listUsersQuerySchema } = require('../validators/user.validator');
const { ROLES }         = require('../utils/constants');

// All user routes require authentication
router.use(verifyToken);

// GET /api/users  (admin only)
router.get(
  '/',
  requireRole(ROLES.ADMIN),
  validate(listUsersQuerySchema, 'query'),
  userController.listUsers,
);

// GET /api/users/:id
router.get('/:id', userController.getUser);

// PATCH /api/users/:id
router.patch(
  '/:id',
  validate(updateUserSchema),
  userController.updateUser,
);

// DELETE /api/users/:id  (self or admin)
router.delete('/:id', userController.deleteUser);

module.exports = router;
