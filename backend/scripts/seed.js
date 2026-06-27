/**
 * @file scripts/seed.js
 * @description Seeds the database with demo users and rooms.
 *
 * Usage:
 *   node scripts/seed.js            ← seeds using MONGODB_URI from .env
 *   node scripts/seed.js --reset    ← clears existing data first
 *
 * Demo accounts created:
 *   admin@synccode.dev  /  Admin@123   (role: admin)
 *   alice@synccode.dev  /  Alice@123   (role: user)
 *   bob@synccode.dev    /  Bob@1234    (role: user)
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const crypto   = require('crypto');

// ── Load models ───────────────────────────────────────────────────────────────
const User = require('../src/models/User');
const Room = require('../src/models/Room');

// ── Helper: generate a random roomId ─────────────────────────────────────────
function generateRoomId(len = 10) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.randomBytes(len)).map((b) => alpha[b % alpha.length]).join('');
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const USERS = [
  { username: 'admin', email: 'admin@synccode.dev', password: 'Admin@123', role: 'admin',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff' },
  { username: 'alice', email: 'alice@synccode.dev', password: 'Alice@123', role: 'user',
    avatar: 'https://ui-avatars.com/api/?name=Alice&background=10b981&color=fff' },
  { username: 'bob',   email: 'bob@synccode.dev',   password: 'Bob@1234',  role: 'user',
    avatar: 'https://ui-avatars.com/api/?name=Bob&background=f59e0b&color=fff' },
];

const ROOM_TEMPLATES = [
  { name: 'JavaScript Playground', language: 'javascript', isPublic: true,
    description: 'A public room for experimenting with JavaScript' },
  { name: 'Python Data Science',   language: 'python',     isPublic: true,
    description: 'Collaborative Python and data analysis workspace' },
  { name: "Alice's Private Lab",   language: 'typescript', isPublic: false,
    description: 'Private TypeScript workspace for Alice' },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  const reset = process.argv.includes('--reset');

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/synccode';
  console.log(`\n🌱  Connecting to ${uri}…`);

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'synccode' });
  console.log('✅  Connected.\n');

  // Optionally clear existing data
  if (reset) {
    await User.deleteMany({});
    await Room.deleteMany({});
    console.log('🗑️   Cleared existing users and rooms.\n');
  }

  // Create users
  console.log('👤  Seeding users…');
  const createdUsers = [];
  for (const u of USERS) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`   ⚠  Skipping existing: ${u.email}`);
      createdUsers.push(existing);
      continue;
    }
    const passwordHash = await User.hashPassword(u.password);
    const user = await User.create({ ...u, passwordHash });
    console.log(`   ✔  Created ${u.role.padEnd(6)} : ${u.email}  /  ${u.password}`);
    createdUsers.push(user);
  }

  const [adminUser, aliceUser] = createdUsers;

  // Create rooms
  console.log('\n🏠  Seeding rooms…');
  for (let i = 0; i < ROOM_TEMPLATES.length; i++) {
    const t     = ROOM_TEMPLATES[i];
    const owner = i === 0 ? adminUser : aliceUser;

    const exists = await Room.findOne({ name: t.name });
    if (exists) { console.log(`   ⚠  Skipping existing: "${t.name}"`); continue; }

    const room = await Room.create({
      roomId:      generateRoomId(),
      name:        t.name,
      owner:       owner._id,
      language:    t.language,
      isPublic:    t.isPublic,
      description: t.description,
      members:     i === 0 ? [{ user: aliceUser._id, role: 'editor' }] : [],
    });
    const access = t.isPublic ? '🌍 public ' : '🔒 private';
    console.log(`   ✔  [${access}] "${room.name}"  (${room.language})`);
  }

  console.log('\n✅  Seed complete!\n');
  console.log('┌──────────────────────────────────────────────┐');
  console.log('│  Demo Login Credentials                      │');
  console.log('├──────────────────────────────────────────────┤');
  console.log('│  admin@synccode.dev   /  Admin@123  (admin)  │');
  console.log('│  alice@synccode.dev   /  Alice@123  (user)   │');
  console.log('│  bob@synccode.dev     /  Bob@1234   (user)   │');
  console.log('└──────────────────────────────────────────────┘\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
