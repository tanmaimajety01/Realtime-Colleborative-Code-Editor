/**
 * @file tests/room.test.js
 * @description Integration tests for /api/rooms endpoints.
 */

const request = require('supertest');
const app     = require('../app');

// ── Helpers ──────────────────────────────────────────────────────────────────

const USER_A = { username: 'usera', email: 'usera@example.com', password: 'TestPass1' };
const USER_B = { username: 'userb', email: 'userb@example.com', password: 'TestPass1' };

async function register(user) {
  const res = await request(app).post('/api/auth/register').send(user);
  return { token: res.body.data?.accessToken, user: res.body.data?.user };
}

async function createRoom(token, body = {}) {
  return request(app)
    .post('/api/rooms')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Room', language: 'javascript', ...body });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/rooms
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/rooms', () => {
  let tokenA;

  beforeEach(async () => {
    ({ token: tokenA } = await register(USER_A));
  });

  it('should create a room and return 201', async () => {
    const res = await createRoom(tokenA, { name: 'My Room', language: 'python', isPublic: true });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: 'My Room', language: 'python', isPublic: true });
    expect(res.body.data).toHaveProperty('roomId');
  });

  it('should return 422 if name is missing', async () => {
    const res = await createRoom(tokenA, { name: '' });
    expect(res.status).toBe(422);
  });

  it('should return 422 for unsupported language', async () => {
    const res = await createRoom(tokenA, { language: 'brainfuck' });
    expect(res.status).toBe(422);
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).post('/api/rooms').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/rooms
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/rooms', () => {
  let tokenA;

  beforeEach(async () => {
    ({ token: tokenA } = await register(USER_A));
    await createRoom(tokenA, { name: 'Room 1' });
    await createRoom(tokenA, { name: 'Room 2', isPublic: true });
  });

  it('should return paginated rooms', async () => {
    const res = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('should respect limit query param', async () => {
    const res = await request(app)
      .get('/api/rooms?limit=1')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/rooms/:roomId
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/rooms/:roomId', () => {
  let tokenA, tokenB, roomId;

  beforeEach(async () => {
    ({ token: tokenA } = await register(USER_A));
    ({ token: tokenB } = await register(USER_B));

    const roomRes = await createRoom(tokenA, { isPublic: false });
    roomId = roomRes.body.data?.roomId;
  });

  it('should return room details for owner', async () => {
    const res = await request(app)
      .get(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.roomId).toBe(roomId);
  });

  it('should return 403 for a user with no access to private room', async () => {
    const res = await request(app)
      .get(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for a non-existent room', async () => {
    const res = await request(app)
      .get('/api/rooms/nonexistentroom999')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/rooms/:roomId
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/rooms/:roomId', () => {
  let tokenA, tokenB, roomId;

  beforeEach(async () => {
    ({ token: tokenA } = await register(USER_A));
    ({ token: tokenB } = await register(USER_B));
    const roomRes = await createRoom(tokenA);
    roomId = roomRes.body.data?.roomId;
  });

  it('should allow owner to update room', async () => {
    const res = await request(app)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('should return 403 for non-owner', async () => {
    const res = await request(app)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/rooms/:roomId/snapshot
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/rooms/:roomId/snapshot', () => {
  let tokenA, roomId;

  beforeEach(async () => {
    ({ token: tokenA } = await register(USER_A));
    const roomRes = await createRoom(tokenA);
    roomId = roomRes.body.data?.roomId;
  });

  it('should save a code snapshot', async () => {
    const res = await request(app)
      .post(`/api/rooms/${roomId}/snapshot`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'console.log("hello");' });

    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe('console.log("hello");');
  });

  it('should return 422 if code is missing', async () => {
    const res = await request(app)
      .post(`/api/rooms/${roomId}/snapshot`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/rooms/:roomId
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/rooms/:roomId', () => {
  let tokenA, tokenB, roomId;

  beforeEach(async () => {
    ({ token: tokenA } = await register(USER_A));
    ({ token: tokenB } = await register(USER_B));
    const roomRes = await createRoom(tokenA);
    roomId = roomRes.body.data?.roomId;
  });

  it('should allow owner to delete room', async () => {
    const res = await request(app)
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);

    // Room should no longer be accessible
    const check = await request(app)
      .get(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(check.status).toBe(404);
  });

  it('should return 403 for non-owner delete attempt', async () => {
    const res = await request(app)
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });
});
