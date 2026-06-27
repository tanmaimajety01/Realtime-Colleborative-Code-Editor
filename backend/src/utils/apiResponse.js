/**
 * @file apiResponse.js
 * @description Standardised API response helpers.
 * All responses follow the shape:
 *   { success, message, data?, errors?, meta? }
 */

/**
 * Send a successful response.
 * @param {import('express').Response} res
 * @param {object} options
 * @param {*}      options.data     - Payload to send
 * @param {string} options.message  - Human-readable message
 * @param {number} options.status   - HTTP status code (default 200)
 * @param {object} options.meta     - Pagination / extra metadata
 */
const success = (res, { data = null, message = 'Success', status = 200, meta = null } = {}) => {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  if (meta !== null) body.meta = meta;
  return res.status(status).json(body);
};

/**
 * Send a created (201) response.
 */
const created = (res, { data = null, message = 'Created successfully' } = {}) =>
  success(res, { data, message, status: 201 });

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {object} options
 * @param {string}   options.message  - Error description
 * @param {number}   options.status   - HTTP status code (default 500)
 * @param {string[]} options.errors   - Field-level validation errors
 */
const error = (res, { message = 'Internal server error', status = 500, errors = null } = {}) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
};

/**
 * Build pagination metadata from query params and total count.
 * @param {number} total - Total documents matching the query
 * @param {number} page  - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {object} meta
 */
const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

module.exports = { success, created, error, paginationMeta };
