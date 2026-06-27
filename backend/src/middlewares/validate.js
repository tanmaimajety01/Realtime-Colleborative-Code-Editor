/**
 * @file middlewares/validate.js
 * @description Joi validation middleware factory for request body, params, and query.
 */

const { error } = require('../utils/apiResponse');
const { MESSAGES } = require('../utils/constants');

/**
 * Create a validation middleware for a Joi schema.
 *
 * @param {import('joi').Schema} schema
 * @param {'body'|'query'|'params'} source - Which part of req to validate
 * @returns {import('express').RequestHandler}
 *
 * @example
 *   router.post('/register', validate(registerSchema, 'body'), controller);
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error: joiError, value } = schema.validate(req[source], {
    abortEarly:  false, // collect ALL errors, not just the first
    stripUnknown: true, // silently remove keys not in schema
    convert:      true, // coerce types (e.g. "20" → 20 for integers)
  });

  if (joiError) {
    const errors = joiError.details.map((d) => d.message.replace(/['"]/g, ''));
    return error(res, { message: MESSAGES.VALIDATION_ERROR, status: 422, errors });
  }

  // Replace request data with sanitized, coerced values
  req[source] = value;
  next();
};

module.exports = validate;
