const CF = 'https://api.cloudflare.com/client/v4';

function zone(domain) {
  const map = {
    'aerosys.aero':    process.env.CLOUDFLARE_ZONE_ID_AEROSYS,
    'macro-soft.com':  process.env.CLOUDFLARE_ZONE_ID_MACROSOFT,
  };
  return map[domain] || process.env.CLOUDFLARE_ZONE_ID;
}

async function cf(path, opts = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN not set');
  const r = await fetch(`${CF}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const d = await r.json();
  if (!d.success) throw new Error(JSON.stringify(d.errors));
  return d.result;
}

export default async function handler(req, res) {
  const zoneId = zone(req.query.domain || 'aerosys.aero');
  if (!zoneId) return res.status(400).json({ error: 'No zone configured for that domain' });

  try {
    if (req.method === 'GET') {
      return res.json({ records: await cf(`/zones/${zoneId}/dns_records`) });
    }
    if (req.method === 'POST') {
      const { type, name, content, ttl, proxied } = req.body;
      return res.status(201).json({ record: await cf(`/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({ type, name, content, ttl: ttl || 3600, proxied: !!proxied }),
      })});
    }
    if (req.method === 'DELETE') {
      if (!req.query.id) return res.status(400).json({ error: 'id param required' });
      await cf(`/zones/${zoneId}/dns_records/${req.query.id}`, { method: 'DELETE' });
      return res.json({ deleted: req.query.id });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
