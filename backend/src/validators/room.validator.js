/**
 * @file validators/room.validator.js
 * @description Joi schemas for room management endpoints.
 */

const Joi = require('joi');
const { LIMITS, SUPPORTED_LANGUAGES, ROOM_ROLES } = require('../utils/constants');

const createRoomSchema = Joi.object({
  name: Joi.string()
    .min(LIMITS.ROOM_NAME_MIN)
    .max(LIMITS.ROOM_NAME_MAX)
    .trim()
    .required()
    .messages({ 'any.required': 'Room name is required.' }),

  language: Joi.string()
    .valid(...SUPPORTED_LANGUAGES)
    .default('javascript'),

  isPublic: Joi.boolean().default(false),

  description: Joi.string().max(500).trim().optional().allow(''),

  tags: Joi.array()
    .items(Joi.string().max(30).trim())
    .max(10)
    .default([]),
});

const updateRoomSchema = Joi.object({
  name:        Joi.string().min(LIMITS.ROOM_NAME_MIN).max(LIMITS.ROOM_NAME_MAX).trim().optional(),
  language:    Joi.string().valid(...SUPPORTED_LANGUAGES).optional(),
  isPublic:    Joi.boolean().optional(),
  description: Joi.string().max(500).trim().optional().allow(''),
  tags:        Joi.array().items(Joi.string().max(30).trim()).max(10).optional(),
}).min(1).message('At least one field must be provided for update.');

const addMemberSchema = Joi.object({
  userId: Joi.string().length(24).hex().required()
    .messages({ 'any.required': 'userId is required.', 'string.length': 'userId must be a valid ObjectId.' }),
  role:   Joi.string()
    .valid(ROOM_ROLES.EDITOR, ROOM_ROLES.VIEWER)
    .default(ROOM_ROLES.VIEWER),
});

const saveSnapshotSchema = Joi.object({
  code: Joi.string().max(LIMITS.CODE_MAX_BYTES).required()
    .messages({ 'any.required': 'code is required.' }),
});

const listRoomsQuerySchema = Joi.object({
  page:     Joi.number().integer().min(1).default(1),
  limit:    Joi.number().integer().min(1).max(100).default(20),
  search:   Joi.string().max(100).trim().optional(),
  language: Joi.string().valid(...SUPPORTED_LANGUAGES).optional(),
  isPublic: Joi.boolean().optional(),
  sortBy:   Joi.string().valid('createdAt', 'name', 'updatedAt').default('createdAt'),
  sortDir:  Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  createRoomSchema,
  updateRoomSchema,
  addMemberSchema,
  saveSnapshotSchema,
  listRoomsQuerySchema,
};
