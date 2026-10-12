'use strict';
const router      = require('express').Router();
const { randomUUID } = require('crypto');
const db          = require('../database');
const requireAuth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

// ── GET /api/payslips ─────────────────────────────────
// Admin → all requests. Staff → own requests only.
router.get('/', requireAuth, (req, res) => {
  let rows;
  if (req.user.isAdmin) {
    rows = db.prepare('SELECT * FROM payslip_requests ORDER BY createdAt DESC').all();
  } else {
    rows = db.prepare('SELECT * FROM payslip_requests WHERE staffId=? ORDER BY createdAt DESC')
      .all(req.user.id);
  }
  res.json(rows.map(norm));
});

// ── POST /api/payslips — submit a request (staff) ─────
router.post('/', requireAuth, (req, res) => {
  const { month, year,
    basic=0, rent=0, teachingAllow=0, arrears=0,
    pension=0, allowance=0, tax=0, otherDed=0,
    batchId=null } = req.body || {};

  if (!month || !year)
    return res.status(400).json({ error: 'Month and year are required.' });

  // Prevent duplicate request for same month/year (per staff)
  const dup = db.prepare(
    'SELECT _id FROM payslip_requests WHERE staffId=? AND month=? AND year=?'
  ).get(req.user.id, month, year);
  if (dup) return res.status(409).json({ error: 'Already applied for this period.' });

  const gross = Number(basic) + Number(rent) + Number(teachingAllow) + Number(arrears) + Number(allowance);
  const deds  = Number(pension) + Number(tax) + Number(otherDed);
  const net   = gross - deds;

  const _id = 'req_' + randomUUID().replace(/-/g,'').slice(0,12);

  db.prepare(`INSERT INTO payslip_requests
    (_id,staffId,month,year,batchId,status,basic,rent,teachingAllow,arrears,pension,allowance,tax,otherDed,gross,deds,net)
    VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?)
  `).run(_id, req.user.id, month, year, batchId||null,
    Number(basic), Number(rent), Number(teachingAllow), Number(arrears),
    Number(pension), Number(allowance), Number(tax), Number(otherDed),
    gross, deds, net);

  res.status(201).json(norm(db.prepare('SELECT * FROM payslip_requests WHERE _id=?').get(_id)));
});

// ── PATCH /api/payslips/:id/status (admin) ───────────
router.patch('/:id/status', requireAuth, adminOnly, (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!['approved','rejected','pending'].includes(status))
    return res.status(400).json({ error: 'Invalid status.' });

  const row = db.prepare('SELECT _id FROM payslip_requests WHERE _id=?').get(id);
  if (!row) return res.status(404).json({ error: 'Request not found.' });

  db.prepare('UPDATE payslip_requests SET status=? WHERE _id=?').run(status, id);
  res.json(norm(db.prepare('SELECT * FROM payslip_requests WHERE _id=?').get(id)));
});

// ── POST /api/payslips/bulk — admin bulk-generates slips ──
router.post('/bulk', requireAuth, adminOnly, (req, res) => {
  const { month, year, staffIds=[], slipData={} } = req.body || {};
  if (!month || !year) return res.status(400).json({ error: 'Month and year required.' });

  const batchId = 'batch_' + randomUUID().replace(/-/g,'').slice(0,8);
  const insert  = db.prepare(`INSERT OR IGNORE INTO payslip_requests
    (_id,staffId,month,year,batchId,status,basic,rent,teachingAllow,arrears,pension,allowance,tax,otherDed,gross,deds,net)
    VALUES (?,?,?,?,?,'approved',?,?,?,?,?,?,?,?,?,?,?)
  `);

  const insertMany = db.transaction((ids) => {
    const created = [];
    for (const sid of ids) {
      const d = slipData[sid] || {};
      const basic=Number(d.basic||0), rent=Number(d.rent||0),
            teachingAllow=Number(d.teachingAllow||0), arrears=Number(d.arrears||0),
            pension=Number(d.pension||0), allowance=Number(d.allowance||0),
            tax=Number(d.tax||0), otherDed=Number(d.otherDed||0);
      const gross = basic+rent+teachingAllow+arrears+allowance;
      const deds  = pension+tax+otherDed;
      const net   = gross-deds;
      const _id   = 'req_'+randomUUID().replace(/-/g,'').slice(0,12);
      insert.run(_id,sid,month,year,batchId,basic,rent,teachingAllow,arrears,pension,allowance,tax,otherDed,gross,deds,net);
      created.push(_id);
    }
    return created;
  });

  const created = insertMany(staffIds);
  res.status(201).json({ batchId, created: created.length });
});

function norm(r) {
  return { ...r, id: r._id, sid: r.staffId };
}

module.exports = router;
