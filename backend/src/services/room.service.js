/**
 * @file services/room.service.js
 * @description Business logic for room CRUD, membership, and code snapshots.
 */

const { nanoid }  = require('nanoid');  // generated inline below to avoid ESM issues
const crypto      = require('crypto');
const Room        = require('../models/Room');
const { ROOM_ROLES, ROLES, PAGINATION, LIMITS } = require('../utils/constants');
const logger      = require('../utils/logger');

/**
 * Generate a short unique room ID (nanoid-style using crypto).
 * @param {number} length
 * @returns {string}
 */
function generateRoomId(length = 10) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes    = crypto.randomBytes(length);
  return Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join('');
}

// ── Room Service ─────────────────────────────────────────────────────────────

/**
 * Create a new room.
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.language
 * @param {boolean} data.isPublic
 * @param {string}  data.description
 * @param {string[]} data.tags
 * @param {object}  owner  - authenticated user
 * @returns {Promise<Room>}
 */
async function createRoom({ name, language, isPublic = false, description = '', tags = [] }, owner) {
  // Generate a unique roomId (retry on collision)
  let roomId;
  let attempts = 0;
  do {
    roomId = generateRoomId(10);
    attempts++;
    if (attempts > 10) throw new Error('Could not generate a unique room ID. Please try again.');
  } while (await Room.exists({ roomId }));

  const room = await Room.create({
    roomId,
    name:     name.trim(),
    owner:    owner._id,
    language: language || 'javascript',
    isPublic: Boolean(isPublic),
    description: (description || '').trim().substring(0, 500),
    tags:     Array.isArray(tags) ? tags.slice(0, 10).map(String) : [],
  });

  logger.info(`[Room] Created room "${room.name}" (${room.roomId}) by ${owner._id}`);
  return room.populate('owner', 'username email avatar role');
}

/**
 * List rooms accessible to the requesting user with pagination and filtering.
 */
async function listRooms({ page, limit, search, language, isPublic, sortBy = 'createdAt', sortDir = 'desc' } = {}, requestingUser) {
  const p = Math.max(1, parseInt(page, 10)  || PAGINATION.DEFAULT_PAGE);
  const l = Math.min(
    Math.max(1, parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT),
    PAGINATION.MAX_LIMIT
  );
  const skip = (p - 1) * l;

  // Build filter: show public OR rooms where user is owner/member
  const accessFilter = requestingUser.role === ROLES.ADMIN
    ? {}
    : {
        $or: [
          { isPublic: true },
          { owner: requestingUser._id },
          { 'members.user': requestingUser._id },
        ],
      };

  const filter = { isActive: true, ...accessFilter };

  if (search) {
    filter.$text = { $search: search };
  }

  if (language) {
    filter.language = language;
  }

  if (isPublic !== undefined) {
    filter.isPublic = isPublic === 'true' || isPublic === true;
  }

  const sort = { [sortBy]: sortDir === 'asc' ? 1 : -1 };

  const [rooms, total] = await Promise.all([
    Room.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(l)
      .populate('owner', 'username email avatar')
      .lean({ virtuals: true }),
    Room.countDocuments(filter),
  ]);

  return { rooms, total, page: p, limit: l };
}

/**
 * Get a single room by its roomId string.
 * Validates that the requesting user has access.
 */
async function getRoomById(roomId, requestingUser) {
  const room = await Room.findOne({ roomId, isActive: true })
    .populate('owner', 'username email avatar role')
    .populate('members.user', 'username email avatar');

  if (!room) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  if (!room.canView(requestingUser._id) && requestingUser.role !== ROLES.ADMIN) {
    const err = new Error('Forbidden – you do not have access to this room.');
    err.statusCode = 403;
    throw err;
  }

  return room;
}

/**
 * Update room settings (owner or admin only).
 */
async function updateRoom(roomId, updates, requestingUser) {
  const room = await Room.findOne({ roomId, isActive: true });
  if (!room) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(room.owner) === String(requestingUser._id);
  if (!isOwner && requestingUser.role !== ROLES.ADMIN) {
    const err = new Error('Forbidden – only the room owner can modify settings.');
    err.statusCode = 403;
    throw err;
  }

  const allowed = ['name', 'language', 'isPublic', 'description', 'tags'];
  for (const field of allowed) {
    if (updates[field] !== undefined) {
      room[field] = updates[field];
    }
  }

  await room.save();
  logger.info(`[Room] Room ${roomId} updated by ${requestingUser._id}`);
  return room.populate('owner', 'username email avatar');
}

/**
 * Soft-delete a room.
 */
async function deleteRoom(roomId, requestingUser) {
  const room = await Room.findOne({ roomId, isActive: true });
  if (!room) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(room.owner) === String(requestingUser._id);
  if (!isOwner && requestingUser.role !== ROLES.ADMIN) {
    const err = new Error('Forbidden – only the room owner can delete this room.');
    err.statusCode = 403;
    throw err;
  }

  room.isActive = false;
  await room.save();
  logger.warn(`[Room] Room ${roomId} deleted by ${requestingUser._id}`);
}

/**
 * Add or update a member's role in a room.
 */
async function addMember(roomId, { userId, role }, requestingUser) {
  const room = await Room.findOne({ roomId, isActive: true });
  if (!room) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(room.owner) === String(requestingUser._id);
  if (!isOwner && requestingUser.role !== ROLES.ADMIN) {
    const err = new Error('Forbidden – only the room owner can manage members.');
    err.statusCode = 403;
    throw err;
  }

  // Cannot change the owner's own role via this endpoint
  if (String(userId) === String(room.owner)) {
    const err = new Error('Cannot change the room owner\'s role via this endpoint.');
    err.statusCode = 400;
    throw err;
  }

  const memberRole = Object.values(ROOM_ROLES).includes(role) ? role : ROOM_ROLES.VIEWER;
  room.upsertMember(userId, memberRole);
  await room.save();

  logger.info(`[Room] Member ${userId} added/updated in room ${roomId} as ${memberRole}`);
  return room.populate('members.user', 'username email avatar');
}

/**
 * Remove a member from a room.
 */
async function removeMember(roomId, userId, requestingUser) {
  const room = await Room.findOne({ roomId, isActive: true });
  if (!room) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(room.owner) === String(requestingUser._id);
  const isSelf  = String(userId) === String(requestingUser._id);

  if (!isOwner && !isSelf && requestingUser.role !== ROLES.ADMIN) {
    const err = new Error('Forbidden – you cannot remove this member.');
    err.statusCode = 403;
    throw err;
  }

  if (String(userId) === String(room.owner)) {
    const err = new Error('Cannot remove the room owner.');
    err.statusCode = 400;
    throw err;
  }

  room.removeMember(userId);
  await room.save();
  logger.info(`[Room] Member ${userId} removed from room ${roomId}`);
}

/**
 * Persist a code snapshot for the room.
 */
async function saveSnapshot(roomId, { code }, requestingUser) {
  if (typeof code !== 'string') {
    const err = new Error('code must be a string.');
    err.statusCode = 400;
    throw err;
  }

  if (Buffer.byteLength(code, 'utf8') > LIMITS.CODE_MAX_BYTES) {
    const err = new Error(`Code snapshot exceeds maximum allowed size (${LIMITS.CODE_MAX_BYTES / 1000} KB).`);
    err.statusCode = 413;
    throw err;
  }

  const room = await Room.findOne({ roomId, isActive: true });
  if (!room) {
    const err = new Error('Room not found.');
    err.statusCode = 404;
    throw err;
  }

  if (!room.canEdit(requestingUser._id) && requestingUser.role !== ROLES.ADMIN) {
    const err = new Error('Forbidden – you need editor access to save a snapshot.');
    err.statusCode = 403;
    throw err;
  }

  room.codeSnapshot = { code, savedBy: requestingUser._id, savedAt: new Date() };
  await room.save();

  logger.info(`[Room] Snapshot saved for room ${roomId} by ${requestingUser._id}`);
  return room.codeSnapshot;
}

module.exports = {
  createRoom,
  listRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  addMember,
  removeMember,
  saveSnapshot,
};
