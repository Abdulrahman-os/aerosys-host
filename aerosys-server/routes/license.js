// routes/license.js — Verifies license serials against the local SQLite DB
// (see data/db.js). This replaces the client-side-only demo check in the
// gateway HTML files' "Verify & Activate" step.

import express from 'express';
import { findLicense, revokeLicense, listLicenses } from '../data/db.js';

const router = express.Router();

// POST /api/license/verify  { serial }
router.post('/verify', (req, res) => {
  const { serial } = req.body;
  if (!serial) return res.status(400).json({ error: 'serial is required' });

  const record = findLicense(serial.trim().toUpperCase());
  if (!record) return res.status(404).json({ valid: false, error: 'Unknown or unissued serial number.' });
  if (record.revoked) return res.status(403).json({ valid: false, error: 'This license has been revoked.' });

  res.json({ valid: true, plan: record.plan, email: record.email, issuedAt: record.issued_at });
});

// GET /api/license/list — admin use, protect this behind auth in production
router.get('/list', (req, res) => {
  res.json({ licenses: listLicenses() });
});

// POST /api/license/revoke  { serial } — admin use, protect behind auth
router.post('/revoke', (req, res) => {
  const { serial } = req.body;
  if (!serial) return res.status(400).json({ error: 'serial is required' });
  revokeLicense(serial.trim().toUpperCase());
  res.json({ revoked: serial });
});

export default router;
