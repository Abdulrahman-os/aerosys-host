// routes/cloudflare.js — Real DNS record CRUD + TXT verification-record
// helper for domain/email verification (SPF/DKIM/Mailtrap domain verify,
// Stripe domain verification for Apple Pay, etc).
// Reads CLOUDFLARE_API_TOKEN from process.env only.

import express from 'express';

const router = express.Router();
const CF_BASE = 'https://api.cloudflare.com/client/v4';

async function cfFetch(path, options = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set on this server.');

  const resp = await fetch(`${CF_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const data = await resp.json();
  if (!data.success) throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
  return data.result;
}

function zoneIdFor(domain) {
  // Map each managed domain to its Cloudflare Zone ID via env vars, so one
  // server can manage both aerosys.aero and macro-soft.com zones.
  const map = {
    'aerosys.aero': process.env.CLOUDFLARE_ZONE_ID_AEROSYS,
    'macro-soft.com': process.env.CLOUDFLARE_ZONE_ID_MACROSOFT,
  };
  return map[domain] || process.env.CLOUDFLARE_ZONE_ID; // fallback to single-zone env var
}

// List DNS records for a zone: GET /api/cloudflare/records?domain=aerosys.aero
router.get('/records', async (req, res) => {
  try {
    const zoneId = zoneIdFor(req.query.domain);
    if (!zoneId) return res.status(400).json({ error: 'No zone configured for that domain' });
    const records = await cfFetch(`/zones/${zoneId}/dns_records`);
    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a DNS record — POST body: { domain, type, name, content, ttl, proxied }
router.post('/records', async (req, res) => {
  try {
    const { domain, type, name, content, ttl, proxied } = req.body;
    const zoneId = zoneIdFor(domain);
    if (!zoneId) return res.status(400).json({ error: 'No zone configured for that domain' });

    const record = await cfFetch(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({ type, name, content, ttl: ttl || 3600, proxied: !!proxied }),
    });
    res.status(201).json({ record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a record — DELETE /api/cloudflare/records/:id?domain=aerosys.aero
router.delete('/records/:id', async (req, res) => {
  try {
    const zoneId = zoneIdFor(req.query.domain);
    if (!zoneId) return res.status(400).json({ error: 'No zone configured for that domain' });
    await cfFetch(`/zones/${zoneId}/dns_records/${req.params.id}`, { method: 'DELETE' });
    res.json({ deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Convenience: add a TXT verification record (Mailtrap domain verify, SPF,
// DKIM, Stripe domain association, etc). POST body: { domain, name, value }
router.post('/verify-txt', async (req, res) => {
  try {
    const { domain, name, value } = req.body;
    if (!domain || !name || !value) return res.status(400).json({ error: 'domain, name, and value are required' });
    const zoneId = zoneIdFor(domain);
    if (!zoneId) return res.status(400).json({ error: 'No zone configured for that domain' });

    const record = await cfFetch(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({ type: 'TXT', name, content: value, ttl: 300 }),
    });
    res.status(201).json({ record, note: 'TXT record created. Propagation can take a few minutes; re-check verification in Mailtrap/Stripe dashboard after DNS propagates.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
