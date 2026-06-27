/**
 * @file config/swagger.js
 * @description Swagger/OpenAPI 3.0 specification setup using swagger-jsdoc.
 */

const swaggerJsdoc    = require('swagger-jsdoc');
const swaggerUiExpress = require('swagger-ui-express');
const config = require('./index');

const definition = {
  openapi: '3.0.0',
  info: {
    title:       'SyncCode Backend API',
    version:     '1.0.0',
    description: 'Production-ready REST API for the SyncCode Realtime Collaborative Code Editor. Provides authentication, user management, and room management.',
    contact: {
      name:  'SyncCode Team',
      email: 'support@synccode.dev',
    },
    license: { name: 'MIT' },
  },
  servers: [
    { url: `http://localhost:${config.server.port}/api`, description: 'Local Development' },
    { url: 'https://your-production-domain.com/api',    description: 'Production' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type:         'http',
        scheme:       'bearer',
        bearerFormat: 'JWT',
        description:  'Provide your JWT access token in the Authorization header.',
      },
    },
    schemas: {
      // ── Common ──────────────────────────────────────────────────────────
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string',  example: 'Success' },
          data:    { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string',  example: 'Error description' },
          errors:  { type: 'array', items: { type: 'string' } },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total:       { type: 'integer', example: 42 },
          page:        { type: 'integer', example: 1  },
          limit:       { type: 'integer', example: 20 },
          totalPages:  { type: 'integer', example: 3  },
          hasNextPage: { type: 'boolean', example: true },
          hasPrevPage: { type: 'boolean', example: false },
        },
      },
      // ── User ─────────────────────────────────────────────────────────────
      User: {
        type: 'object',
        properties: {
          _id:       { type: 'string', example: '665a1f3c2b4a5d6e7f8a9b0c' },
          username:  { type: 'string', example: 'alice' },
          email:     { type: 'string', example: 'alice@example.com' },
          role:      { type: 'string', enum: ['admin', 'user', 'viewer'], example: 'user' },
          avatar:    { type: 'string', example: 'https://cdn.example.com/avatar.png' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      // ── Room ─────────────────────────────────────────────────────────────
      Room: {
        type: 'object',
        properties: {
          _id:          { type: 'string', example: '665a1f3c2b4a5d6e7f8a9b0d' },
          roomId:       { type: 'string', example: 'abc123xyz' },
          name:         { type: 'string', example: 'My JS Playground' },
          language:     { type: 'string', example: 'javascript' },
          isPublic:     { type: 'boolean', example: true },
          owner:        { $ref: '#/components/schemas/User' },
          membersCount: { type: 'integer', example: 3 },
          createdAt:    { type: 'string', format: 'date-time' },
          updatedAt:    { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth',   description: 'Authentication and authorization' },
    { name: 'Users',  description: 'User management'                  },
    { name: 'Rooms',  description: 'Collaborative room management'    },
    { name: 'Health', description: 'Server health checks'             },
  ],
};

const options = {
  definition,
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Mount Swagger UI middleware onto an Express app.
 * @param {import('express').Application} app
 */
function setupSwagger(app) {
  // Serve raw JSON spec
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
  app.use(
    '/api/docs',
    swaggerUiExpress.serve,
    swaggerUiExpress.setup(swaggerSpec, {
      explorer:     true,
      customSiteTitle: 'SyncCode API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion:         'none',
        filter:               true,
      },
    }),
  );
}

module.exports = { setupSwagger, swaggerSpec };
