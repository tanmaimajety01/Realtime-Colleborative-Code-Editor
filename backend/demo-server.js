/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYNCCODE BACKEND — DEMO SERVER                        ║
 * ║                                                                  ║
 * ║  Zero-setup demo: uses an in-memory MongoDB (no install needed). ║
 * ║  Pre-seeds demo users + rooms. Perfect for presentations.        ║
 * ║                                                                  ║
 * ║  Run:  node demo-server.js                                       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// ── Colours for pretty console output ────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  blue:   '\x1b[34m',
  red:    '\x1b[31m',
};
const g = (s) => `${C.green}${s}${C.reset}`;
const c = (s) => `${C.cyan}${s}${C.reset}`;
const y = (s) => `${C.yellow}${s}${C.reset}`;
const b = (s) => `${C.bold}${s}${C.reset}`;
const d = (s) => `${C.dim}${s}${C.reset}`;

// ── Step 1: Configure environment BEFORE loading the app ──────────────────────
console.log('\n' + b(c('  SyncCode Backend — Demo Mode ')));
console.log(d('  Starting in-memory database…\n'));

// Set process.env values so config/index.js picks them up
process.env.NODE_ENV               = 'development';
process.env.PORT                   = '5003';
// Friendly secrets for demo (not for production!)
process.env.JWT_ACCESS_SECRET      = 'demo_access_secret_synccode_2024_not_for_production';
process.env.JWT_REFRESH_SECRET     = 'demo_refresh_secret_synccode_2024_not_for_production';
process.env.JWT_ACCESS_EXPIRES_IN  = '2h';     // longer TTL for demo convenience
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_SALT_ROUNDS     = '8';      // faster hashing for demo startup
process.env.CORS_ORIGINS           = 'http://localhost:3000,http://localhost:5001,http://localhost:5003';
process.env.LOG_LEVEL              = 'warn';   // keep demo console clean

// ── Step 2: Seed data definitions ────────────────────────────────────────────
const DEMO_USERS = [
  {
    username:    'admin',
    email:       'admin@synccode.dev',
    password:    'Admin@123',
    role:        'admin',
    avatar:      'https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff',
  },
  {
    username:    'alice',
    email:       'alice@synccode.dev',
    password:    'Alice@123',
    role:        'user',
    avatar:      'https://ui-avatars.com/api/?name=Alice&background=10b981&color=fff',
  },
  {
    username:    'bob',
    email:       'bob@synccode.dev',
    password:    'Bob@1234',
    role:        'user',
    avatar:      'https://ui-avatars.com/api/?name=Bob&background=f59e0b&color=fff',
  },
];

const DEMO_ROOMS = [
  { name: 'JavaScript Playground',   language: 'javascript', isPublic: true,  description: 'A public room for experimenting with JavaScript.' },
  { name: 'Python Data Science',      language: 'python',      isPublic: true,  description: 'Collaborative Python & data analysis workspace.' },
  { name: "Alice's Private Sandbox",  language: 'typescript',  isPublic: false, description: 'Private room — only Alice can access.' },
];

// ── Step 3: Boot sequence ─────────────────────────────────────────────────────
async function startDemo() {
  // 3a. Spin up in-memory MongoDB
  const mongoServer = await MongoMemoryServer.create();
  const uri         = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB  = 'synccode_demo';

  // 3b. Connect mongoose directly (bypass the background connector in database.js)
  await mongoose.connect(uri, { dbName: 'synccode_demo' });

  // 3c. Load models AFTER mongoose connects
  const User   = require('./src/models/User');
  const Room   = require('./src/models/Room');
  const crypto = require('crypto');

  // 3d. Create demo users
  const createdUsers = [];
  for (const u of DEMO_USERS) {
    const passwordHash = await User.hashPassword(u.password);
    const user = await User.create({
      username:  u.username,
      email:     u.email,
      passwordHash,
      role:      u.role,
      avatar:    u.avatar,
    });
    createdUsers.push({ ...u, _id: user._id });
  }
  const [adminUser, aliceUser] = createdUsers;

  // 3e. Create demo rooms (owned by alice, admin is member)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  function genId(n = 10) {
    const bytes = crypto.randomBytes(n);
    return Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join('');
  }

  for (let i = 0; i < DEMO_ROOMS.length; i++) {
    const r = DEMO_ROOMS[i];
    const owner = i === 0 ? adminUser : aliceUser; // Admin owns room 1, Alice owns 2 & 3
    await Room.create({
      roomId:      genId(10),
      name:        r.name,
      owner:       owner._id,
      language:    r.language,
      isPublic:    r.isPublic,
      description: r.description,
      members:     i === 0
        ? [{ user: aliceUser._id, role: 'editor' }]   // Alice is editor in room 1
        : [],
    });
  }

  // 3f. Mark DB as connected so routes don't return 503
  //     (We connected directly above, so mongoose.connection.readyState === 1 already)

  // 3g. Load and start the Express app
  const http   = require('http');
  const app    = require('./app');
  const PORT   = parseInt(process.env.PORT, 10);
  const server = http.createServer(app);

  server.listen(PORT, () => {
    printBanner(PORT);
    printDemoCredentials();
    printRoutes(PORT);
  });

  // 3h. Graceful shutdown — also stop in-memory MongoDB
  const stop = async (signal) => {
    console.log(`\n${y(`  [${signal}] Shutting down demo…`)}`);
    server.close(async () => {
      await mongoose.connection.close();
      await mongoServer.stop();
      console.log(g('  Demo server stopped. Goodbye!\n'));
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT',  () => stop('SIGINT'));
  process.on('uncaughtException',  (e) => console.error('[demo] Uncaught:', e.message));
  process.on('unhandledRejection', (r) => console.error('[demo] Rejection:', r));
}

// ── Helpers: pretty output ────────────────────────────────────────────────────

function printBanner(port) {
  const line = '═'.repeat(60);
  console.log(`\n${C.cyan}${line}${C.reset}`);
  console.log(b(c('   🚀  SyncCode Backend API — DEMO MODE')));
  console.log(`${C.cyan}${line}${C.reset}`);
  console.log(`   ${g('✔')} In-memory MongoDB   ${d('(no install needed)')}`);
  console.log(`   ${g('✔')} Demo users & rooms  ${d('(pre-seeded)')}`);
  console.log(`   ${g('✔')} JWT Auth enabled`);
  console.log(`   ${g('✔')} Swagger UI ready`);
  console.log(`${C.cyan}${line}${C.reset}`);
  console.log(`   📡  API Base  : ${c(`http://localhost:${port}/api`)}`);
  console.log(`   📚  Docs      : ${c(`http://localhost:${port}/api/docs`)}`);
  console.log(`   🎮  Demo UI   : ${c(`http://localhost:${port}/demo`)}`);
  console.log(`   ❤️   Health    : ${c(`http://localhost:${port}/api/health`)}`);
  console.log(`${C.cyan}${line}${C.reset}\n`);
}

function printDemoCredentials() {
  console.log(b('  👤  Demo Credentials'));
  console.log('  ' + '─'.repeat(44));
  console.log(`  ${b('Role')}       ${b('Email')}                    ${b('Password')}`);
  console.log('  ' + '─'.repeat(44));
  console.log(`  ${'admin'.padEnd(10)} ${'admin@synccode.dev'.padEnd(25)} Admin@123`);
  console.log(`  ${'user'.padEnd(10)} ${'alice@synccode.dev'.padEnd(25)} Alice@123`);
  console.log(`  ${'user'.padEnd(10)} ${'bob@synccode.dev'.padEnd(25)} Bob@1234`);
  console.log('  ' + '─'.repeat(44) + '\n');
}

function printRoutes(port) {
  const base = `http://localhost:${port}/api`;
  console.log(b('  📡  API Routes'));
  console.log('  ' + '─'.repeat(55));

  const routes = [
    ['POST', '/auth/register',          'Register a new user'],
    ['POST', '/auth/login',             'Login → get JWT tokens'],
    ['GET',  '/auth/me',                'Get current user  [🔒 Auth]'],
    ['POST', '/auth/refresh',           'Refresh access token'],
    ['POST', '/auth/logout',            'Logout session    [🔒 Auth]'],
    ['GET',  '/users',                  'List all users    [🔒 Admin]'],
    ['GET',  '/users/:id',              'Get user profile  [🔒 Auth]'],
    ['PATCH','/users/:id',              'Update profile    [🔒 Auth]'],
    ['GET',  '/rooms',                  'List my rooms     [🔒 Auth]'],
    ['POST', '/rooms',                  'Create room       [🔒 Auth]'],
    ['GET',  '/rooms/:roomId',          'Get room details  [🔒 Auth]'],
    ['PATCH','/rooms/:roomId',          'Update room       [🔒 Owner]'],
    ['POST', '/rooms/:roomId/members',  'Add member        [🔒 Owner]'],
    ['POST', '/rooms/:roomId/snapshot', 'Save code         [🔒 Editor]'],
    ['GET',  '/health',                 'Health check'],
  ];

  const colors = { GET: g, POST: c, PATCH: y, DELETE: (s) => `${C.red}${s}${C.reset}` };

  for (const [method, path, desc] of routes) {
    const col   = colors[method] || ((s) => s);
    const mpad  = method.padEnd(6);
    const ppad  = path.padEnd(30);
    console.log(`  ${col(mpad)} ${ppad} ${d(desc)}`);
  }

  console.log('  ' + '─'.repeat(55));
  console.log(`\n  ${d('Open')} ${c(`http://localhost:${port}/demo`)} ${d('for the interactive demo UI')}\n`);
}

// ── Go! ───────────────────────────────────────────────────────────────────────
startDemo().catch((err) => {
  console.error(`\n${C.red}[Demo] Failed to start: ${err.message}${C.reset}`);
  console.error(err.stack);
  process.exit(1);
});
