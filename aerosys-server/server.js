// server.js — AeroSys Unified Backend
// Self-hosted Node/Express server. Run this on YOUR OWN infrastructure
// (VPS, bare metal, Docker host, Render, Railway, Fly.io, etc.) — anywhere
// with unrestricted outbound network access to Stripe / Cloudflare / Mailtrap.
//
// Quick start:
//   cp .env.example .env        # fill in your real (rotated) keys
//   npm install
//   npm start                   # listens on PORT (default 4000)
//
// Or with Docker:
//   docker compose up -d --build

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import checkoutRoutes from './routes/checkout.js';
import webhookRoutes from './routes/webhook.js';
import mailRoutes from './routes/mail.js';
import cloudflareRoutes from './routes/cloudflare.js';
import licenseRoutes from './routes/license.js';
import adminRoutes from './routes/admin.js';
import storageRoutes from './routes/storage.js';

const app = express();
const PORT = process.env.PORT || 4000;

// CORS: lock this down to your actual gateway domains in production
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  credentials: true,
}));

// Stripe webhook needs the RAW body for signature verification —
// mount it BEFORE the global json() parser, on its own raw route.
app.use('/api/checkout/webhook', express.raw({ type: 'application/json' }));

// Everything else gets normal JSON parsing
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'aerosys-unified-backend', time: new Date().toISOString() }));

app.use('/api/checkout', checkoutRoutes);
app.use('/api/checkout/webhook', webhookRoutes); // separate router, raw body already applied above
app.use('/api/mail', mailRoutes);
app.use('/api/cloudflare', cloudflareRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/storage', storageRoutes);

// Serve the 3 gateway HTML files (and the webservices/portal sites, if you
// copy them into /public) as static assets from this same server.
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`AeroSys unified backend listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
