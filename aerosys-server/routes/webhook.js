// routes/webhook.js — Verifies Stripe webhook signatures (real, not simulated),
// issues a license serial, persists it to the local SQLite DB, and emails it
// via Mailtrap. Mounted with express.raw() in server.js (required for
// Stripe's signature check to work).

import express from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { insertLicense } from '../data/db.js';
import { sendLicenseEmail } from './mail.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

function generateSerial(prefix) {
  const seg = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${prefix}-${seg()}-${seg()}-${seg()}`;
}

const prefixMap = { pilot: 'AS9', fleet: 'AS9', operator: 'MC', agency: 'MC', dev: 'RTOS', team: 'RTOS', site: 'RTOS' };

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not set — refusing to process unverified webhook.');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;
  try {
    // req.body is the raw Buffer here because of express.raw() in server.js
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const plan = session.metadata?.plan || 'unknown';
    const email = session.customer_email;
    const serial = generateSerial(prefixMap[plan] || 'AERO');

    try {
      insertLicense({ serial, email, plan, stripeSessionId: session.id });
    } catch (dbErr) {
      console.error('Failed to persist license:', dbErr.message);
    }

    try {
      await sendLicenseEmail({ to: email, plan, serial });
    } catch (mailErr) {
      console.error('Failed to send license email (license was still issued and stored):', mailErr.message);
    }
  }

  res.json({ received: true });
});

export default router;
