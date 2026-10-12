'use strict';
const router      = require('express').Router();
const { randomUUID } = require('crypto');
const db          = require('../database');
const requireAuth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

// GET /api/years
router.get('/', requireAuth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM years ORDER BY label DESC').all());
});

// POST /api/years (admin)
router.post('/', requireAuth, adminOnly, (req, res) => {
  const { label } = req.body || {};
  if (!label) return res.status(400).json({ error: 'Year label is required.' });
  const exists = db.prepare('SELECT _id FROM years WHERE label=?').get(String(label));
  if (exists) return res.status(409).json({ error: 'Year already exists.' });
  const _id = 'year_' + String(label);
  db.prepare('INSERT INTO years (_id, label) VALUES (?,?)').run(_id, String(label));
  res.status(201).json(db.prepare('SELECT * FROM years WHERE _id=?').get(_id));
});

// DELETE /api/years/:id (admin)
router.delete('/:id', requireAuth, adminOnly, (req, res) => {
  const row = db.prepare('SELECT _id FROM years WHERE _id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Year not found.' });
  db.prepare('DELETE FROM years WHERE _id=?').run(req.params.id);
  res.json({ message: 'Year removed.' });
});

module.exports = router;
