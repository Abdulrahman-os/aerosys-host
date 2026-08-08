export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const list = (process.env.ADMIN_EMAILS || 'admin@webservices.aerosys.aero,admin@webservices.macro-soft.com')
    .split(',').map(s => s.trim().toLowerCase());
  res.json({ isAdmin: list.includes(email.trim().toLowerCase()), email });
}
