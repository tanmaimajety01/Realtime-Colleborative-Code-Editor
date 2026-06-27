/**
 * @file models/Room.js
 * @description Mongoose Room schema for collaborative coding sessions.
 * Relationships:  Room →(owner)→ User | Room →(members[])→ User
 */

const mongoose = require('mongoose');
const { ROOM_ROLES, SUPPORTED_LANGUAGES, LIMITS } = require('../utils/constants');

// ── Sub-schema: room member ──────────────────────────────────────────────────
const memberSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    role: {
      type:    String,
      enum:    Object.values(ROOM_ROLES),
      default: ROOM_ROLES.VIEWER,
    },
    joinedAt: {
      type:    Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ── Sub-schema: code snapshot ────────────────────────────────────────────────
const snapshotSchema = new mongoose.Schema(
  {
    code:      { type: String, default: '' },
    savedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    savedAt:   { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main Room schema ─────────────────────────────────────────────────────────
const roomSchema = new mongoose.Schema(
  {
    // Short, human-friendly ID shared with Socket.IO room identifier
    roomId: {
      type:      String,
      required:  [true, 'roomId is required.'],
      unique:    true,
      trim:      true,
      index:     true,
    },

    name: {
      type:      String,
      required:  [true, 'Room name is required.'],
      trim:      true,
      minlength: [LIMITS.ROOM_NAME_MIN, 'Room name must not be empty.'],
      maxlength: [LIMITS.ROOM_NAME_MAX, `Room name must be at most ${LIMITS.ROOM_NAME_MAX} characters.`],
    },

    owner: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Owner is required.'],
      index:    true,
    },

    members: {
      type:    [memberSchema],
      default: [],
    },

    language: {
      type:    String,
      enum:    SUPPORTED_LANGUAGES,
      default: 'javascript',
    },

    // Latest persisted code snapshot
    codeSnapshot: {
      type: snapshotSchema,
      default: () => ({ code: '', savedBy: null, savedAt: new Date() }),
    },

    // Public rooms can be joined by any authenticated user
    isPublic: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    // Soft-delete
    isActive: {
      type:    Boolean,
      default: true,
      index:   true,
    },

    // Optional description / tags
    description: {
      type:    String,
      default: '',
      trim:    true,
      maxlength: 500,
    },

    tags: {
      type:    [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON:  { virtuals: true },
    toObject:{ virtuals: true },
  }
);

// ── Virtual: member count ────────────────────────────────────────────────────
roomSchema.virtual('membersCount').get(function () {
  return this.members.length;
});

// ── Indexes ──────────────────────────────────────────────────────────────────
roomSchema.index({ owner: 1, isActive: 1 });
roomSchema.index({ isPublic: 1, isActive: 1, createdAt: -1 });
roomSchema.index({ 'members.user': 1, isActive: 1 });
// Text search index on name & description.
// IMPORTANT: set language_override to a non-conflicting field ('textLang') so
// MongoDB does not confuse our 'language' coding-language field with the text
// index language selector (which only accepts ISO language names like 'english').
roomSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 5 }, default_language: 'english', language_override: 'textLang' }
);

// ── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Get the requesting user's role in this room (or null if not a member).
 * @param {string|ObjectId} userId
 * @returns {string|null}
 */
roomSchema.methods.getMemberRole = function (userId) {
  const id = String(userId);
  if (String(this.owner) === id) return ROOM_ROLES.OWNER;
  const member = this.members.find((m) => String(m.user) === id);
  return member ? member.role : null;
};

/**
 * Check if a user has at least "editor" access.
 * @param {string|ObjectId} userId
 * @returns {boolean}
 */
roomSchema.methods.canEdit = function (userId) {
  const role = this.getMemberRole(userId);
  return role === ROOM_ROLES.OWNER || role === ROOM_ROLES.EDITOR;
};

/**
 * Check if a user has any access (owner | editor | viewer).
 * Public rooms also pass.
 * @param {string|ObjectId} userId
 * @returns {boolean}
 */
roomSchema.methods.canView = function (userId) {
  if (this.isPublic) return true;
  return this.getMemberRole(userId) !== null;
};

/**
 * Add or update a member's role.
 * @param {string|ObjectId} userId
 * @param {string}          role
 */
roomSchema.methods.upsertMember = function (userId, role) {
  const id  = String(userId);
  const idx = this.members.findIndex((m) => String(m.user) === id);
  if (idx >= 0) {
    this.members[idx].role = role;
  } else {
    this.members.push({ user: userId, role, joinedAt: new Date() });
  }
};

/**
 * Remove a member by userId.
 * @param {string|ObjectId} userId
 */
roomSchema.methods.removeMember = function (userId) {
  const id = String(userId);
  this.members = this.members.filter((m) => String(m.user) !== id);
};

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
