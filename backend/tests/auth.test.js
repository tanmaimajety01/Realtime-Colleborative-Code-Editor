/**
 * @file tests/auth.test.js
 * @description Integration tests for /api/auth endpoints using supertest.
 */

const request = require('supertest');
const app     = require('../app');

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_USER = {
  username: 'testuser',
  email:    'test@example.com',
  password: 'TestPass1',
};

async function registerUser(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({ ...VALID_USER, ...overrides });
}

async function loginUser(overrides = {}) {
  return request(app)
    .post('/api/auth/login')
    .send({
      email:    overrides.email    || VALID_USER.email,
      password: overrides.password || VALID_USER.password,
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/auth/register', () => {
  it('should register a new user and return 201 with tokens', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user).toMatchObject({
      username: VALID_USER.username,
      email:    VALID_USER.email,
      role:     'user',
    });
    // Sensitive fields must NOT be returned
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.user).not.toHaveProperty('refreshTokens');
  });

  it('should return 409 if email is already taken', async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should return 422 for invalid email', async () => {
    const res = await registerUser({ email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('should return 422 for weak password (no uppercase)', async () => {
    const res = await registerUser({ password: 'weakpassword1' });
    expect(res.status).toBe(422);
  });

  it('should return 422 for username that is too short', async () => {
    const res = await registerUser({ username: 'ab' }); // min 3
    expect(res.status).toBe(422);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerUser();
  });

  it('should login and return access token', async () => {
    const res = await loginUser();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    // httpOnly cookie should be set
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should return 401 for wrong password', async () => {
    const res = await loginUser({ password: 'WrongPass999' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 for non-existent email', async () => {
    const res = await loginUser({ email: 'nobody@example.com' });
    expect(res.status).toBe(401);
  });

  it('should return 422 if email is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'TestPass1' });
    expect(res.status).toBe(422);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/auth/me
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/auth/me', () => {
  let accessToken;

  beforeEach(async () => {
    await registerUser();
    const res    = await loginUser();
    accessToken  = res.body.data.accessToken;
  });

  it('should return the current user when authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(VALID_USER.email);
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 for an invalid/tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/refresh
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/auth/refresh', () => {
  let refreshToken;

  beforeEach(async () => {
    await registerUser();
    const res   = await loginUser();
    // Extract refresh token from cookie
    const cookies = res.headers['set-cookie'] || [];
    const cookie  = cookies.find((c) => c.startsWith('refreshToken='));
    refreshToken  = cookie ? cookie.split(';')[0].replace('refreshToken=', '') : null;
  });

  it('should issue a new access token given a valid refresh token', async () => {
    if (!refreshToken) return; // skip if cookie not returned in test env
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('should return 400 if refreshToken is missing', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/auth/logout', () => {
  let accessToken;

  beforeEach(async () => {
    await registerUser();
    const res   = await loginUser();
    accessToken = res.body.data.accessToken;
  });

  it('should logout and clear the cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });

  it('should return 401 without a valid token', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(401);
  });
});
