// routes/admin.js — Server-side admin allowlist check. This is the source
// of truth for "admin gets full access without a paid plan" — the client-side
// checks in the gateway HTML are just UX shortcuts; always trust this route.
//
// Configure via ADMIN_EMAILS env var (comma-separated). Defaults to the two
// official addresses if not set.

import express from 'express';

const router = express.Router();

function getAdminList() {
  const raw = process.env.ADMIN_EMAILS || 'admin@webservices.aerosys.aero,admin@webservices.macro-soft.com';
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

router.post('/check', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const isAdmin = getAdminList().includes(String(email).trim().toLowerCase());
  res.json({ isAdmin, email });
});

export default router;
