export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { from, subject, message, ticketPrefix } = req.body || {};
  if (!from || !message) return res.status(400).json({ error: 'from and message required' });

  const token = process.env.MAILTRAP_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'Mail not configured on this server' });

  const ticketId = `${ticketPrefix || 'AERO'}-${Math.floor(Math.random() * 90000 + 10000)}`;

  try {
    const resp = await fetch('https://send.api.mailtrap.io/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        from: { email: 'admin@webservices.aerosys.aero', name: 'AeroSys Support' },
        to: [{ email: process.env.SUPPORT_INBOX || 'admin@webservices.aerosys.aero' }],
        reply_to: [{ email: from }],
        subject: `[Ticket #${ticketId}] ${subject || 'Support request'} — from ${from}`,
        text: message,
        html: `<p><b>From:</b> ${from}</p><p><b>Subject:</b> ${subject || '—'}</p><hr/><p>${message}</p>`,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: `Mailtrap error: ${err}` });
    }

    res.json({ ticketId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
