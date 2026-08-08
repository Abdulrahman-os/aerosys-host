import Stripe from 'stripe';
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';

export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

function generateSerial(prefix) {
  const seg = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${prefix}-${seg()}-${seg()}-${seg()}`;
}

const PREFIX = { pilot:'AS9', fleet:'AS9', operator:'MC', agency:'MC', dev:'RTOS', team:'RTOS', site:'RTOS' };

async function sendMail({ to, plan, serial }) {
  const token = process.env.MAILTRAP_API_TOKEN;
  if (!token) return;
  await fetch('https://send.api.mailtrap.io/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      from: { email: 'admin@webservices.aerosys.aero', name: 'AeroSys Avionics Ltd' },
      to: [{ email: to }],
      subject: `Your AeroSys access code — ${plan.toUpperCase()} plan`,
      text: `Your access code: ${serial}\n\nPlan: ${plan}\n\nEnter this at the gateway to activate your account.`,
      html: `<p><b>Your access code:</b> <code style="font-size:1.2em">${serial}</code></p><p>Plan: ${plan}</p>`,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await buffer(req);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const plan = session.metadata?.plan || 'unknown';
    const email = session.customer_email;
    const serial = generateSerial(PREFIX[plan] || 'AERO');

    // Persist to cloud Postgres
    try {
      const sql = neon(process.env.CLOUD_DATABASE_URL);
      await sql`
        CREATE TABLE IF NOT EXISTS licenses (
          id SERIAL PRIMARY KEY, serial TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL, plan TEXT NOT NULL,
          stripe_session_id TEXT, revoked BOOLEAN DEFAULT false,
          issued_at TIMESTAMPTZ DEFAULT now()
        )`;
      await sql`INSERT INTO licenses (serial, email, plan, stripe_session_id)
                VALUES (${serial}, ${email}, ${plan}, ${session.id})
                ON CONFLICT (serial) DO NOTHING`;
    } catch (dbErr) {
      console.error('DB persist error:', dbErr.message);
    }

    await sendMail({ to: email, plan, serial });
  }

  res.json({ received: true });
}
