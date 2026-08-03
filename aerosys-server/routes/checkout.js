// routes/checkout.js — Creates real Stripe Checkout Sessions.
// Reads STRIPE_SECRET_KEY from process.env only.

import express from 'express';
import Stripe from 'stripe';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const PLAN_PRICE_MAP = {
  pilot: process.env.STRIPE_PRICE_PILOT,
  fleet: process.env.STRIPE_PRICE_FLEET,
  operator: process.env.STRIPE_PRICE_OPERATOR,
  agency: process.env.STRIPE_PRICE_AGENCY,
  dev: process.env.STRIPE_PRICE_RTOS_DEV,
  team: process.env.STRIPE_PRICE_RTOS_TEAM,
  site: process.env.STRIPE_PRICE_RTOS_SITE,
};

router.post('/create-session', async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured on this server.' });
    }

    const { plan, email, mode, successUrl, cancelUrl } = req.body;
    const priceId = PLAN_PRICE_MAP[plan];
    if (!priceId) {
      return res.status(400).json({ error: `Unknown or unconfigured plan: ${plan}` });
    }

    const session = await stripe.checkout.sessions.create({
      mode: mode || 'subscription', // 'payment' for RTOS one-time license tiers
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${process.env.PUBLIC_URL || 'http://localhost:4000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.PUBLIC_URL || 'http://localhost:4000'}/cancel`,
      metadata: { plan },
    });

    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Checkout session creation failed', detail: err.message });
  }
});

export default router;
