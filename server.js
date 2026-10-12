'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { PORT } = require('./config');

// Boot database (creates schema + seeds if empty)
require('./database');

const app = express();

// ── Middleware ──────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Serve frontend ──────────────────────────────────
// Copy udss-payslip-portal-v12.html → public/index.html
const PUBLIC = path.join(__dirname, 'public');
app.use(express.static(PUBLIC));

// ── API Routes ──────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/staff',    require('./routes/staff'));
app.use('/api/payslips', require('./routes/payslips'));
app.use('/api/years',    require('./routes/years'));
app.use('/api/banners',  require('./routes/banners'));

// ── Health check ─────────────────────────────────────
app.get('/api/ping', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── SPA fallback ─────────────────────────────────────
app.get(/^(?!\/api).*/, (_req, res) => {
  const idx = path.join(PUBLIC, 'index.html');
  res.sendFile(idx, err => {
    if (err) res.status(404).send('Copy udss-payslip-portal-v12.html to public/index.html');
  });
});

// ── Global error handler ─────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message || err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ┌──────────────────────────────────────────────┐
  │  UDSS Payslip Portal — Backend Server        │
  │  Powered by ZAI NOVA LTD (RC8601354)         │
  ├──────────────────────────────────────────────┤
  │  Running on  →  http://localhost:${PORT}         │
  │  API Base    →  http://localhost:${PORT}/api     │
  │  Database    →  udss.db  (SQLite / WAL)      │
  └──────────────────────────────────────────────┘
  `);
});

module.exports = app;
