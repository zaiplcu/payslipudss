'use strict';
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');

const DB_PATH = path.join(__dirname, 'udss.db');
const db = new Database(DB_PATH);

// ── Enable WAL mode for better concurrency ──
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─────────────────────── SCHEMA ───────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    _id          TEXT    PRIMARY KEY,
    name         TEXT    NOT NULL,
    username     TEXT    UNIQUE NOT NULL,
    email        TEXT    UNIQUE NOT NULL,
    password     TEXT    NOT NULL,
    bursaryNo    TEXT    DEFAULT '',
    category     TEXT    DEFAULT '',
    grade        TEXT    DEFAULT '',
    bank         TEXT    DEFAULT '',
    branch       TEXT    DEFAULT '',
    accountNo    TEXT    DEFAULT '',
    pensionAdmin TEXT    DEFAULT '',
    rsaPin       TEXT    DEFAULT '',
    isAdmin      INTEGER DEFAULT 0,
    mustChangePw INTEGER DEFAULT 1,
    createdAt    TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payslip_requests (
    _id       TEXT    PRIMARY KEY,
    staffId   TEXT    NOT NULL REFERENCES staff(_id) ON DELETE CASCADE,
    month     TEXT    NOT NULL,
    year      TEXT    NOT NULL,
    batchId   TEXT    DEFAULT NULL,
    status    TEXT    DEFAULT 'pending',   -- pending | approved | rejected
    basic     REAL    DEFAULT 0,
    rent      REAL    DEFAULT 0,
    teachingAllow REAL DEFAULT 0,
    arrears   REAL    DEFAULT 0,
    pension   REAL    DEFAULT 0,
    allowance REAL    DEFAULT 0,
    tax       REAL    DEFAULT 0,
    otherDed  REAL    DEFAULT 0,
    gross     REAL    DEFAULT 0,
    deds      REAL    DEFAULT 0,
    net       REAL    DEFAULT 0,
    createdAt TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS years (
    _id   TEXT PRIMARY KEY,
    label TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS banners (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS security_questions (
    staffId      TEXT PRIMARY KEY REFERENCES staff(_id) ON DELETE CASCADE,
    question     TEXT NOT NULL,
    answerHash   TEXT NOT NULL
  );
`);

// ─────────────────────── SEED ───────────────────────
// Seed admin + 2 demo staff only if table is empty
const count = db.prepare('SELECT COUNT(*) AS n FROM staff').get().n;
if (count === 0) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO staff
      (_id, name, username, email, password, bursaryNo, category, grade,
       bank, branch, accountNo, pensionAdmin, rsaPin, isAdmin, mustChangePw)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const { SEED_ADMIN_PW, SEED_STAFF1_PW, SEED_STAFF2_PW } = require('./config');

  // Admin account
  insert.run(
    'admin_001',
    'Administrator',
    'admin',
    'admin@udss.edu.ng',
    bcrypt.hashSync(SEED_ADMIN_PW, 10),
    'ADM/001', 'Administration', 'GL-17',
    '', '', '', '', '',
    1, 0
  );

  // Staff 1
  insert.run(
    'staff_001',
    'NARTEY DANIEL',
    'nartey.daniel',
    'nartey.daniel@udss.edu.ng',
    bcrypt.hashSync(SEED_STAFF1_PW, 10),
    'BSY/2201', 'Teaching', 'GL-08',
    'First Bank Nigeria', 'Ugbowo Branch', '3012345678', 'AIICO Pension', 'RSA/12345',
    0, 0
  );

  // Staff 2
  insert.run(
    'staff_002',
    'AMAKA BELLO',
    'amaka.bello',
    'amaka.bello@udss.edu.ng',
    bcrypt.hashSync(SEED_STAFF2_PW, 10),
    'BSY/2202', 'Non-Teaching', 'GL-06',
    'Zenith Bank', 'Benin City Branch', '2098765432', 'ARM Pension', 'RSA/67890',
    0, 0
  );

  // Seed a current year
  const yr = String(new Date().getFullYear());
  db.prepare('INSERT OR IGNORE INTO years (_id, label) VALUES (?,?)').run('year_'+yr, yr);

  console.log('[DB] Seeded admin + 2 demo staff + year', yr);
}

module.exports = db;
