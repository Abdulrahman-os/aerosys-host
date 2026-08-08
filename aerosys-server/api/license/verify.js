import { neon } from '@neondatabase/serverless';

async function getDb() {
  const url = process.env.CLOUD_DATABASE_URL;
  if (!url) throw new Error('CLOUD_DATABASE_URL not set');
  const sql = neon(url);
  // Ensure schema exists on first call
  await sql`CREATE TABLE IF NOT EXISTS licenses (
    id SERIAL PRIMARY KEY, serial TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL, plan TEXT NOT NULL,
    stripe_session_id TEXT, revoked BOOLEAN DEFAULT false,
    issued_at TIMESTAMPTZ DEFAULT now()
  )`;
  return sql;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { serial } = req.body || {};
    if (!serial) return res.status(400).json({ error: 'serial required' });

    try {
      const sql = await getDb();
      const rows = await sql`SELECT * FROM licenses WHERE serial = ${serial.trim().toUpperCase()}`;
      if (!rows.length) return res.status(404).json({ valid: false, error: 'Unknown serial number' });
      if (rows[0].revoked) return res.status(403).json({ valid: false, error: 'License revoked' });
      return res.json({ valid: true, plan: rows[0].plan, email: rows[0].email, issuedAt: rows[0].issued_at });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    // Admin: list all licenses
    try {
      const sql = await getDb();
      const rows = await sql`SELECT * FROM licenses ORDER BY issued_at DESC`;
      return res.json({ licenses: rows });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
