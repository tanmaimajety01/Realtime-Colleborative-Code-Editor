/**
 * @file validators/auth.validator.js
 * @description Joi schemas for auth endpoints.
 */

const Joi = require('joi');
const { LIMITS } = require('../utils/constants');

// ── Reusable password rule ───────────────────────────────────────────────────
const passwordRule = Joi.string()
  .min(LIMITS.PASSWORD_MIN)
  .max(LIMITS.PASSWORD_MAX)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .message(
    `Password must be ${LIMITS.PASSWORD_MIN}–${LIMITS.PASSWORD_MAX} characters and include at least one uppercase letter, one lowercase letter, and one number.`
  );

const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(LIMITS.USERNAME_MIN)
    .max(LIMITS.USERNAME_MAX)
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.alphanum': 'Username may only contain letters and numbers.',
      'any.required':    'Username is required.',
    }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(LIMITS.EMAIL_MAX)
    .lowercase()
    .trim()
    .required()
    .messages({ 'any.required': 'Email is required.' }),

  password: passwordRule.required(),
});

const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .trim()
    .required(),

  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const logoutSchema = Joi.object({
  refreshToken: Joi.string().optional(),
  allDevices:   Joi.boolean().default(false),
});

module.exports = { registerSchema, loginSchema, refreshSchema, logoutSchema };
