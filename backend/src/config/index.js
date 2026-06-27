/**
 * @file config/index.js
 * @description Centralised, validated configuration loaded from environment variables.
 * Throws immediately on startup if required variables are missing.
 */

require('dotenv').config();

/**
 * Assert a required environment variable exists and is non-empty.
 * @param {string} key
 * @returns {string}
 */
function required(key) {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`[Config] Required environment variable "${key}" is missing or empty.`);
  }
  return val.trim();
}

/**
 * Read an optional variable with a fallback default.
 * @param {string} key
 * @param {string} defaultValue
 * @returns {string}
 */
function optional(key, defaultValue) {
  const val = process.env[key];
  return val && val.trim() ? val.trim() : defaultValue;
}

const config = {
  env: optional('NODE_ENV', 'development'),
  isDev: optional('NODE_ENV', 'development') === 'development',
  isProd: optional('NODE_ENV', 'development') === 'production',

  server: {
    port: parseInt(optional('PORT', '5003'), 10),
  },

  db: {
    uri: optional('MONGODB_URI', 'mongodb://127.0.0.1:27017/synccode'),
    name: optional('MONGODB_DB', 'synccode'),
  },

  jwt: {
    accessSecret:  optional('JWT_ACCESS_SECRET',  'dev_access_secret_change_in_production'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_in_production'),
    accessExpiresIn:  optional('JWT_ACCESS_EXPIRES_IN',  '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  cors: {
    // Parse comma-separated origins list
    origins: optional('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5001')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 min
    max:      parseInt(optional('RATE_LIMIT_MAX',        '100'),    10),
    authMax:  parseInt(optional('AUTH_RATE_LIMIT_MAX',   '10'),     10),
  },

  bcrypt: {
    saltRounds: parseInt(optional('BCRYPT_SALT_ROUNDS', '12'), 10),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
    dir:   optional('LOG_DIR',   'logs'),
  },
};

// Warn in dev if using default JWT secrets
if (config.isDev) {
  if (config.jwt.accessSecret === 'dev_access_secret_change_in_production') {
    console.warn('[Config] WARNING: Using default JWT_ACCESS_SECRET. Set a strong secret in .env');
  }
  if (config.jwt.refreshSecret === 'dev_refresh_secret_change_in_production') {
    console.warn('[Config] WARNING: Using default JWT_REFRESH_SECRET. Set a strong secret in .env');
  }
}

module.exports = config;
