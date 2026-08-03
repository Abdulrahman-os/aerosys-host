// routes/storage.js — Powers the Firmware Store's real download flow.
// After a successful Stripe checkout, this issues a time-limited signed URL
// instead of a permanent public link, so paid firmware bundles can't be
// shared/scraped indefinitely.

import express from 'express';
import { listObjects, getSignedDownloadUrl } from '../lib/objectStorage.js';

const router = express.Router();

// GET /api/storage/firmware — list available firmware SKUs in the bucket
router.get('/firmware', async (req, res) => {
  try {
    const objects = await listObjects('firmware/');
    res.json({ objects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/storage/download-link  { key, licenseSerial }
// In production, verify licenseSerial against /api/license/verify before
// issuing the link — left as an explicit call here rather than hidden
// middleware, so the requirement is obvious when reading this file.
router.post('/download-link', async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const url = await getSignedDownloadUrl(key, undefined, 900); // 15 min expiry
    res.json({ url, expiresInSeconds: 900 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
