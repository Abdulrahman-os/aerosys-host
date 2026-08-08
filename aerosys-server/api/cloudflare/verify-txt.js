const CF = 'https://api.cloudflare.com/client/v4';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { domain, name, value } = req.body || {};
  if (!domain || !name || !value) return res.status(400).json({ error: 'domain, name, and value required' });

  const zoneMap = {
    'aerosys.aero':   process.env.CLOUDFLARE_ZONE_ID_AEROSYS,
    'macro-soft.com': process.env.CLOUDFLARE_ZONE_ID_MACROSOFT,
  };
  const zoneId = zoneMap[domain] || process.env.CLOUDFLARE_ZONE_ID;
  if (!zoneId) return res.status(400).json({ error: `No zone configured for ${domain}` });

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'CLOUDFLARE_API_TOKEN not set' });

  try {
    const r = await fetch(`${CF}/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: 'TXT', name, content: value, ttl: 300 }),
    });
    const d = await r.json();
    if (!d.success) throw new Error(JSON.stringify(d.errors));
    res.status(201).json({
      record: d.result,
      note: 'TXT record created. Allow a few minutes for DNS propagation before re-checking verification in Mailtrap/Stripe dashboard.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
