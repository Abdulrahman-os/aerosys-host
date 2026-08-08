import Stripe from 'stripe';

const PRICES = {
  pilot:    process.env.STRIPE_PRICE_PILOT,
  fleet:    process.env.STRIPE_PRICE_FLEET,
  operator: process.env.STRIPE_PRICE_OPERATOR,
  agency:   process.env.STRIPE_PRICE_AGENCY,
  dev:      process.env.STRIPE_PRICE_RTOS_DEV,
  team:     process.env.STRIPE_PRICE_RTOS_TEAM,
  site:     process.env.STRIPE_PRICE_RTOS_SITE,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const { plan, email, mode, successUrl, cancelUrl } = req.body || {};
  const priceId = PRICES[plan];

  if (!priceId) return res.status(400).json({ error: `Unknown or unconfigured plan: ${plan}` });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: mode || 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${process.env.PUBLIC_URL || 'https://aerosys-host.vercel.app'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.PUBLIC_URL || 'https://aerosys-host.vercel.app'}/cancel`,
      metadata: { plan },
    });
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
