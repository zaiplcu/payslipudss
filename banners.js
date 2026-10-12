'use strict';
const router      = require('express').Router();
const db          = require('../database');
const requireAuth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

function getVal(key) {
  const row = db.prepare('SELECT value FROM banners WHERE key=?').get(key);
  return row ? JSON.parse(row.value) : null;
}
function setVal(key, val) {
  db.prepare('INSERT INTO banners (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, JSON.stringify(val));
}

// GET /api/banners — returns all banner data
router.get('/', (req, res) => {
  res.json({
    notice:       getVal('notice')       || { text:'', sub:'' },
    advert_left:  getVal('advert_left')  || { text:'', sub:'' },
    advert_right: getVal('advert_right') || { text:'', sub:'' },
  });
});

// PUT /api/banners/notice (admin)
router.put('/notice', requireAuth, adminOnly, (req, res) => {
  const { text='', sub='' } = req.body || {};
  setVal('notice', { text, sub });
  res.json({ message: 'Notice updated.' });
});

// PUT /api/banners/advert/:side (admin)
router.put('/advert/:side', requireAuth, adminOnly, (req, res) => {
  const { side } = req.params;
  if (!['left','right'].includes(side))
    return res.status(400).json({ error: 'Side must be "left" or "right".' });
  const { text='', sub='' } = req.body || {};
  setVal('advert_'+side, { text, sub });
  res.json({ message: 'Advert updated.' });
});

module.exports = router;
