/**
 * @file routes/room.routes.js
 * @description Express router for /api/rooms endpoints.
 */

const router = require('express').Router();

const roomController  = require('../controllers/room.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const validate        = require('../middlewares/validate');
const {
  createRoomSchema,
  updateRoomSchema,
  addMemberSchema,
  saveSnapshotSchema,
  listRoomsQuerySchema,
} = require('../validators/room.validator');

// All room routes require authentication
router.use(verifyToken);

// GET  /api/rooms
router.get(
  '/',
  validate(listRoomsQuerySchema, 'query'),
  roomController.listRooms,
);

// POST /api/rooms
router.post(
  '/',
  validate(createRoomSchema),
  roomController.createRoom,
);

// GET  /api/rooms/:roomId
router.get('/:roomId', roomController.getRoom);

// PATCH /api/rooms/:roomId
router.patch(
  '/:roomId',
  validate(updateRoomSchema),
  roomController.updateRoom,
);

// DELETE /api/rooms/:roomId
router.delete('/:roomId', roomController.deleteRoom);

// POST /api/rooms/:roomId/members
router.post(
  '/:roomId/members',
  validate(addMemberSchema),
  roomController.addMember,
);

// DELETE /api/rooms/:roomId/members/:userId
router.delete('/:roomId/members/:userId', roomController.removeMember);

// POST /api/rooms/:roomId/snapshot
router.post(
  '/:roomId/snapshot',
  validate(saveSnapshotSchema),
  roomController.saveSnapshot,
);

module.exports = router;
