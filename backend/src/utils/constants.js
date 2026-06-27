/**
 * @file constants.js
 * @description Application-wide constants for roles, limits, and messages.
 */

// ── User Roles ─────────────────────────────────────────────────────────────
const ROLES = Object.freeze({
  ADMIN:  'admin',  // full system access
  USER:   'user',   // standard authenticated user
  VIEWER: 'viewer', // read-only access
});

// ── Room Member Roles ───────────────────────────────────────────────────────
const ROOM_ROLES = Object.freeze({
  OWNER:  'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
});

// ── Pagination Defaults ─────────────────────────────────────────────────────
const PAGINATION = Object.freeze({
  DEFAULT_PAGE:  1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT:     100,
});

// ── Field Length Limits ─────────────────────────────────────────────────────
const LIMITS = Object.freeze({
  USERNAME_MIN:   3,
  USERNAME_MAX:   30,
  PASSWORD_MIN:   8,
  PASSWORD_MAX:   72,   // bcrypt hard limit
  ROOM_NAME_MIN:  1,
  ROOM_NAME_MAX:  80,
  EMAIL_MAX:      254,
  CODE_MAX_BYTES: 500_000, // 500 KB snapshot limit
});

// ── Supported Languages ─────────────────────────────────────────────────────
const SUPPORTED_LANGUAGES = Object.freeze([
  'javascript', 'typescript', 'python', 'java', 'c', 'cpp',
  'csharp', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin',
  'htmlmixed', 'css', 'sql', 'bash', 'json', 'yaml', 'markdown',
]);

// ── Token Types ─────────────────────────────────────────────────────────────
const TOKEN_TYPES = Object.freeze({
  ACCESS:  'access',
  REFRESH: 'refresh',
});

// ── HTTP Status Messages ────────────────────────────────────────────────────
const MESSAGES = Object.freeze({
  UNAUTHORIZED:     'Unauthorized – please log in.',
  FORBIDDEN:        'Forbidden – you do not have permission.',
  NOT_FOUND:        'Resource not found.',
  VALIDATION_ERROR: 'Validation failed.',
  INTERNAL_ERROR:   'Internal server error – please try again.',
  CONFLICT:         'Resource already exists.',
  CREATED:          'Resource created successfully.',
  UPDATED:          'Resource updated successfully.',
  DELETED:          'Resource deleted successfully.',
  SUCCESS:          'Success.',
});

module.exports = {
  ROLES,
  ROOM_ROLES,
  PAGINATION,
  LIMITS,
  SUPPORTED_LANGUAGES,
  TOKEN_TYPES,
  MESSAGES,
};
