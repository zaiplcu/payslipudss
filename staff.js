'use strict';
const router      = require('express').Router();
const bcrypt      = require('bcryptjs');
const { randomUUID } = require('crypto');
const db          = require('../database');
const requireAuth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

const SAFE_COLS = `_id, name, username, email, bursaryNo, category, grade,
  bank, branch, accountNo, pensionAdmin, rsaPin, isAdmin, mustChangePw, createdAt`;

// ── GET /api/staff — list all (admin only) ──
router.get('/', requireAuth, adminOnly, (_req, res) => {
  const rows = db.prepare(`SELECT ${SAFE_COLS} FROM staff ORDER BY name`).all();
  res.json(rows.map(normalise));
});

// ── POST /api/staff — create staff (admin only) ──
router.post('/', requireAuth, adminOnly, (req, res) => {
  const { name, username, email, password,
    bursaryNo='', category='', grade='',
    bank='', branch='', accountNo='', pensionAdmin='', rsaPin='',
    isAdmin=false, mustChangePw=true } = req.body || {};

  if (!name || !username || !email || !password)
    return res.status(400).json({ error: 'Name, username, email and password are required.' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });

  // Check unique
  const exists = db.prepare('SELECT _id FROM staff WHERE LOWER(username)=? OR LOWER(email)=?')
    .get(username.toLowerCase(), email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Username or email already exists.' });

  const _id = 'staff_' + randomUUID().replace(/-/g,'').slice(0,12);
  const hash = bcrypt.hashSync(password, 10);

  db.prepare(`INSERT INTO staff
    (_id,name,username,email,password,bursaryNo,category,grade,bank,branch,accountNo,pensionAdmin,rsaPin,isAdmin,mustChangePw)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(_id, name.toUpperCase(), username, email.toLowerCase(), hash,
    bursaryNo, category, grade, bank, branch, accountNo, pensionAdmin, rsaPin,
    isAdmin?1:0, mustChangePw?1:0);

  const row = db.prepare(`SELECT ${SAFE_COLS} FROM staff WHERE _id=?`).get(_id);
  res.status(201).json(normalise(row));
});

// ── PUT /api/staff/:id — update staff (admin only) ──
router.put('/:id', requireAuth, adminOnly, (req, res) => {
  const { id } = req.params;
  const s = db.prepare('SELECT * FROM staff WHERE _id=?').get(id);
  if (!s) return res.status(404).json({ error: 'Staff not found.' });

  const {
    name=s.name, username=s.username, email=s.email,
    bursaryNo=s.bursaryNo, category=s.category, grade=s.grade,
    bank=s.bank, branch=s.branch, accountNo=s.accountNo,
    pensionAdmin=s.pensionAdmin, rsaPin=s.rsaPin,
    isAdmin=s.isAdmin, mustChangePw=s.mustChangePw
  } = req.body || {};

  db.prepare(`UPDATE staff SET
    name=?,username=?,email=?,bursaryNo=?,category=?,grade=?,
    bank=?,branch=?,accountNo=?,pensionAdmin=?,rsaPin=?,
    isAdmin=?,mustChangePw=?
    WHERE _id=?
  `).run(name.toUpperCase(), username, email.toLowerCase(),
    bursaryNo, category, grade, bank, branch, accountNo, pensionAdmin, rsaPin,
    isAdmin?1:0, mustChangePw?1:0, id);

  const row = db.prepare(`SELECT ${SAFE_COLS} FROM staff WHERE _id=?`).get(id);
  res.json(normalise(row));
});

// ── POST /api/staff/:id/reset-password (admin only) ──
router.post('/:id/reset-password', requireAuth, adminOnly, (req, res) => {
  const { id } = req.params;
  const { password, mustChangePw=true } = req.body || {};
  if (!password || password.length < 4)
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });

  const s = db.prepare('SELECT _id FROM staff WHERE _id=?').get(id);
  if (!s) return res.status(404).json({ error: 'Staff not found.' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE staff SET password=?, mustChangePw=? WHERE _id=?')
    .run(hash, mustChangePw?1:0, id);
  res.json({ message: 'Password reset.' });
});

// ── DELETE /api/staff/:id (admin only) ──
router.delete('/:id', requireAuth, adminOnly, (req, res) => {
  const { id } = req.params;
  const s = db.prepare('SELECT _id FROM staff WHERE _id=?').get(id);
  if (!s) return res.status(404).json({ error: 'Staff not found.' });
  db.prepare('DELETE FROM staff WHERE _id=?').run(id);
  res.json({ message: 'Staff removed.' });
});

// ── Normalise row (booleans) ──
function normalise(s) {
  return { ...s, id: s._id, isAdmin: !!s.isAdmin, mustChangePw: !!s.mustChangePw };
}

module.exports = router;
