/**
 * @file validators/user.validator.js
 * @description Joi schemas for user management endpoints.
 */

const Joi = require('joi');
const { LIMITS, ROLES } = require('../utils/constants');

const updateUserSchema = Joi.object({
  username: Joi.string()
    .min(LIMITS.USERNAME_MIN)
    .max(LIMITS.USERNAME_MAX)
    .pattern(/^[a-z0-9_-]+$/)
    .lowercase()
    .trim()
    .optional()
    .messages({
      'string.pattern.base': 'Username may only contain lowercase letters, numbers, hyphens, and underscores.',
    }),

  avatar: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(500)
    .optional()
    .allow(''),

  currentPassword: Joi.string().when('password', {
    is:        Joi.exist(),
    then:      Joi.required(),
    otherwise: Joi.optional(),
  }),

  password: Joi.string()
    .min(LIMITS.PASSWORD_MIN)
    .max(LIMITS.PASSWORD_MAX)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .optional()
    .messages({
      'string.pattern.base': 'Password must include at least one uppercase letter, one lowercase letter, and one number.',
    }),

  // Admin-only fields — the controller enforces this
  role:     Joi.string().valid(...Object.values(ROLES)).optional(),
  isActive: Joi.boolean().optional(),
});

const listUsersQuerySchema = Joi.object({
  page:    Joi.number().integer().min(1).default(1),
  limit:   Joi.number().integer().min(1).max(100).default(20),
  search:  Joi.string().max(100).trim().optional(),
  role:    Joi.string().valid(...Object.values(ROLES)).optional(),
  sortBy:  Joi.string().valid('createdAt', 'username', 'email', 'lastLoginAt').default('createdAt'),
  sortDir: Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = { updateUserSchema, listUsersQuerySchema };
