// routes/mail.js — Real transactional email via Mailtrap's Send API.
// Reads MAILTRAP_API_TOKEN from process.env only.

import express from 'express';

const router = express.Router();
const MAILTRAP_SEND_URL = 'https://send.api.mailtrap.io/api/send';

async function mailtrapSend({ to, subject, text, html }) {
  const token = process.env.MAILTRAP_API_TOKEN;
  if (!token) throw new Error('MAILTRAP_API_TOKEN is not set on this server.');

  const body = {
    from: {
      email: process.env.MAIL_FROM_ADDRESS || 'admin@webservices.aerosys.aero',
      name: process.env.MAIL_FROM_NAME || 'AeroSys Avionics Ltd',
    },
    to: [{ email: to }],
    subject,
    text,
    html,
    category: 'aerosys-gateway',
  };

  const resp = await fetch(MAILTRAP_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Mailtrap send failed (${resp.status}): ${errText}`);
  }
  return resp.json();
}

export async function sendLicenseEmail({ to, plan, serial }) {
  const subject = `Your AeroSys access code — ${String(plan).toUpperCase()} plan`;
  const text = `Thanks for your purchase.\n\nPlan: ${plan}\nAccess code: ${serial}\n\nEnter this code on the gateway login screen to activate your account.`;
  const html = `<p>Thanks for your purchase.</p><p><b>Plan:</b> ${plan}<br/><b>Access code:</b> <code>${serial}</code></p><p>Enter this code on the gateway login screen to activate your account.</p>`;
  return mailtrapSend({ to, subject, text, html });
}

// Standalone endpoint used by each gateway's floating "Support / Mail" widget
router.post('/send', async (req, res) => {
  try {
    const { from, subject, message, ticketPrefix } = req.body;
    if (!from || !message) return res.status(400).json({ error: 'from and message are required' });

    const ticketId = `${ticketPrefix || 'AERO'}-${Math.floor(Math.random() * 90000 + 10000)}`;

    await mailtrapSend({
      to: process.env.SUPPORT_INBOX || 'admin@webservices.aerosys.aero',
      subject: `[Ticket #${ticketId}] ${subject || 'Support request'} — from ${from}`,
      text: message,
      html: `<p><b>From:</b> ${from}</p><p>${message}</p>`,
    });

    res.json({ ticketId });
  } catch (err) {
    console.error('Mail send error:', err.message);
    res.status(500).json({ error: 'Failed to send message', detail: err.message });
  }
});

export default router;
