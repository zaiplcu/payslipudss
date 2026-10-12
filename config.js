'use strict';

module.exports = {
  PORT:       process.env.PORT       || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'udss_jwt_secret_zainova_2025_change_in_production',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '8h',

  // Seed passwords — set via environment variables before first run.
  // These are only used once when the database is first created.
  SEED_ADMIN_PW:  process.env.SEED_ADMIN_PW  || 'Admin@2025',
  SEED_STAFF1_PW: process.env.SEED_STAFF1_PW || 'Staff@001',
  SEED_STAFF2_PW: process.env.SEED_STAFF2_PW || 'Staff@002',
};
