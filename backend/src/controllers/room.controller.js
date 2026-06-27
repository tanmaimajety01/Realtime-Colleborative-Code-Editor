/**
 * @file controllers/room.controller.js
 * @description HTTP handlers for room management endpoints.
 *
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Collaborative room management
 */

const roomService = require('../services/room.service');
const { success, created, paginationMeta } = require('../utils/apiResponse');

// ── Create Room ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create a new collaborative room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string, example: My JS Playground }
 *               language:    { type: string, example: javascript }
 *               isPublic:    { type: boolean, example: false }
 *               description: { type: string }
 *               tags:        { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Room created
 *       422:
 *         description: Validation error
 */
const createRoom = async (req, res, next) => {
  try {
    const room = await roomService.createRoom(req.body, req.user);
    return created(res, { message: 'Room created.', data: room });
  } catch (err) {
    next(err);
  }
};

// ── List Rooms ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: List rooms accessible to the current user
 *     tags: [Rooms]
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
 *       - in: query
 *         name: language
 *         schema: { type: string }
 *       - in: query
 *         name: isPublic
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Paginated rooms
 */
const listRooms = async (req, res, next) => {
  try {
    const { rooms, total, page, limit } = await roomService.listRooms(req.query, req.user);
    return success(res, {
      data: rooms,
      meta: paginationMeta(total, page, limit),
    });
  } catch (err) {
    next(err);
  }
};

// ── Get Room ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /rooms/{roomId}:
 *   get:
 *     summary: Get room details
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Room details with members
 *       403:
 *         description: No access
 *       404:
 *         description: Room not found
 */
const getRoom = async (req, res, next) => {
  try {
    const room = await roomService.getRoomById(req.params.roomId, req.user);
    return success(res, { data: room });
  } catch (err) {
    next(err);
  }
};

// ── Update Room ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /rooms/{roomId}:
 *   patch:
 *     summary: Update room settings (owner only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:        { type: string }
 *               language:    { type: string }
 *               isPublic:    { type: boolean }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Room updated
 *       403:
 *         description: Forbidden
 */
const updateRoom = async (req, res, next) => {
  try {
    const room = await roomService.updateRoom(req.params.roomId, req.body, req.user);
    return success(res, { message: 'Room updated.', data: room });
  } catch (err) {
    next(err);
  }
};

// ── Delete Room ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /rooms/{roomId}:
 *   delete:
 *     summary: Delete a room (owner or admin)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Room deleted
 *       403:
 *         description: Forbidden
 */
const deleteRoom = async (req, res, next) => {
  try {
    await roomService.deleteRoom(req.params.roomId, req.user);
    return success(res, { message: 'Room deleted.' });
  } catch (err) {
    next(err);
  }
};

// ── Add Member ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /rooms/{roomId}/members:
 *   post:
 *     summary: Add or update a member in the room (owner only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string }
 *               role:   { type: string, enum: [editor, viewer] }
 *     responses:
 *       200:
 *         description: Member added/updated
 */
const addMember = async (req, res, next) => {
  try {
    const room = await roomService.addMember(req.params.roomId, req.body, req.user);
    return success(res, { message: 'Member updated.', data: room });
  } catch (err) {
    next(err);
  }
};

// ── Remove Member ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /rooms/{roomId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from the room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member removed
 */
const removeMember = async (req, res, next) => {
  try {
    await roomService.removeMember(req.params.roomId, req.params.userId, req.user);
    return success(res, { message: 'Member removed.' });
  } catch (err) {
    next(err);
  }
};

// ── Save Snapshot ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /rooms/{roomId}/snapshot:
 *   post:
 *     summary: Save a code snapshot for the room (editor/owner)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: Snapshot saved
 *       413:
 *         description: Code too large
 */
const saveSnapshot = async (req, res, next) => {
  try {
    const snapshot = await roomService.saveSnapshot(req.params.roomId, req.body, req.user);
    return success(res, { message: 'Snapshot saved.', data: snapshot });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRoom,
  listRooms,
  getRoom,
  updateRoom,
  deleteRoom,
  addMember,
  removeMember,
  saveSnapshot,
};
