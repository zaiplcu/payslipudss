'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../database');
const { JWT_SECRET, JWT_EXPIRY } = require('../config');
const requireAuth = require('../middleware/auth');

// ── POST /api/auth/login ──────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required.' });

  // Match by username OR email (case-insensitive)
  const user = db.prepare(
    'SELECT * FROM staff WHERE LOWER(username)=? OR LOWER(email)=?'
  ).get(username.toLowerCase(), username.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials. Check your username/email and password.' });

  const payload = {
    id:      user._id,
    name:    user.name,
    email:   user.email,
    username:user.username,
    isAdmin: !!user.isAdmin,
    mustChangePw: !!user.mustChangePw,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  // Return token + safe user object (no password)
  const { password: _pw, ...safeUser } = user;
  res.json({ token, user: { ...safeUser, id: safeUser._id, isAdmin: !!safeUser.isAdmin, mustChangePw: !!safeUser.mustChangePw } });
});

// ── POST /api/auth/change-password ────────────────────
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });

  const user = db.prepare('SELECT * FROM staff WHERE _id=?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ error: 'Current password is incorrect.' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE staff SET password=?, mustChangePw=0 WHERE _id=?').run(hash, req.user.id);
  res.json({ message: 'Password changed successfully.' });
});

// ── GET /api/auth/security-question?username=xxx ──────
router.get('/security-question', (req, res) => {
  const { username } = req.query || {};
  if (!username) return res.status(400).json({ error: 'Username is required.' });

  const user = db.prepare(
    'SELECT _id FROM staff WHERE LOWER(username)=? OR LOWER(email)=?'
  ).get(username.toLowerCase(), username.toLowerCase());

  if (!user) return res.status(404).json({ error: 'No account found with that username or email.' });

  const sq = db.prepare('SELECT question FROM security_questions WHERE staffId=?').get(user._id);
  if (!sq) return res.json({ question: null }); // no question set → frontend shows admin contact

  res.json({ question: sq.question });
});

// ── POST /api/auth/security-question (save question for logged-in user) ──
router.post('/security-question', requireAuth, (req, res) => {
  const { question, answerHash } = req.body || {};
  if (!question || !answerHash)
    return res.status(400).json({ error: 'Question and answer are required.' });

  db.prepare(`
    INSERT INTO security_questions (staffId, question, answerHash) VALUES (?,?,?)
    ON CONFLICT(staffId) DO UPDATE SET question=excluded.question, answerHash=excluded.answerHash
  `).run(req.user.id, question, answerHash);

  res.json({ message: 'Security question saved.' });
});

// ── POST /api/auth/forgot-password ────────────────────
router.post('/forgot-password', (req, res) => {
  const { username, answerHash, newPassword } = req.body || {};
  if (!username || !answerHash || !newPassword)
    return res.status(400).json({ error: 'All fields are required.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const user = db.prepare(
    'SELECT * FROM staff WHERE LOWER(username)=? OR LOWER(email)=?'
  ).get(username.toLowerCase(), username.toLowerCase());

  if (!user) return res.status(404).json({ error: 'Account not found.' });

  const sq = db.prepare('SELECT * FROM security_questions WHERE staffId=?').get(user._id);
  if (!sq) return res.status(400).json({ error: 'No security question set. Contact Admin.' });

  // Compare the answerHash sent by frontend
  if (answerHash !== sq.answerHash)
    return res.status(401).json({ error: 'Incorrect answer. Please try again.' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE staff SET password=?, mustChangePw=0 WHERE _id=?').run(hash, user._id);
  res.json({ message: 'Password reset successfully.' });
});

module.exports = router;
