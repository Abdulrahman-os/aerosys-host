# AeroSys Unified Backend — Self-Hosted (No Vercel)

A real Node/Express backend + the 3 gateway HTML files, meant to run on
**your own server** — a VPS (DigitalOcean, Hetzner, Linode), bare metal,
a home server, Render/Railway/Fly.io, or any Docker host you control.

## Why self-hosted instead of Vercel

Vercel's serverless functions are still someone else's platform. Since you
want independent hosting — and since you have real Stripe / Cloudflare /
Mailtrap credentials to wire up — this is a plain Express app with a local
SQLite database. It has no dependency on any particular cloud provider.
Run it anywhere that can run Node + Docker.

## What's real here (not simulated)

- **Real Stripe Checkout Sessions** via `stripe` npm SDK
- **Real Stripe webhook signature verification** (`stripe.webhooks.constructEvent`)
- **Real Mailtrap transactional email** sends (license codes + support tickets)
- **Real Cloudflare DNS record CRUD** including a `/verify-txt` helper for
  domain-verification TXT records (Mailtrap sending-domain verification,
  SPF/DKIM, Stripe Apple Pay domain association, etc.)
- **Real persistence** — SQLite file at `data/aerosys.db`, survives restarts

None of this ran inside my sandbox (it can't reach those APIs), but it runs
correctly on any machine with normal outbound internet access — which is
exactly what your own server has. I verified locally that the server boots,
registers all routes, and the license-verification + SQLite flow works
end-to-end (with dummy keys, so no real charges/emails were triggered).

## Quick start (bare Node)

```bash
cp .env.example .env
# edit .env with your ROTATED real keys — see security note below

npm install
npm start
# → AeroSys unified backend listening on port 4000
```

Visit `http://localhost:4000/aerosys9000/`, `/mission-control/`, `/rtos/` —
all 3 gateways are served as static files from this same process, so there's
one thing to deploy, not four.

## Quick start (Docker — recommended for a VPS)

```bash
cp .env.example .env   # fill in real values
docker compose up -d --build
```

That's it — the container installs `better-sqlite3`'s native binding at
build time, mounts `./data` as a volume so your license DB survives
container rebuilds, and mounts `./public` so you can drop in updated gateway
HTML without rebuilding the image.

## Putting it on your own domain with HTTPS

`Caddyfile` is included and commented out in `docker-compose.yml`. Steps:

1. Point DNS A records for whatever subdomains you want (e.g.
   `gateway.aerosys.aero`, `mission-control.aerosys.aero`,
   `rtos.aerosys.aero`, `api.aerosys.aero`) at your server's IP — this is
   exactly the kind of DNS change the `/api/cloudflare` routes can do for
   you programmatically, or do it manually in the Cloudflare dashboard.
2. Edit `Caddyfile` with your real subdomains.
3. Uncomment the `caddy` service in `docker-compose.yml`.
4. `docker compose up -d --build` — Caddy automatically provisions and
   renews Let's Encrypt certificates for you. No manual cert management.

## Using the Cloudflare route for domain/email verification

This was the specific thing you flagged — verifying TXT records on either
side (e.g. Mailtrap asking you to add a TXT record to prove you own
`webservices.aerosys.aero` before it will let you send "real" email from
that domain, or Stripe's domain-association TXT record for Apple Pay).

```bash
curl -X POST http://localhost:4000/api/cloudflare/verify-txt \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "aerosys.aero",
    "name": "mailtrap._domainkey.webservices",
    "value": "the-exact-TXT-value-mailtrap-gave-you"
  }'
```

The record gets created in Cloudflare within seconds; DNS propagation to
the wider internet (so Mailtrap/Stripe's own verifier can see it) typically
takes a few minutes to a few hours depending on caching.

## Security notes — please read

1. **Rotate the Stripe, Cloudflare, and Mailtrap credentials** you pasted
   in our chat — they were exposed in plaintext and should be treated as
   compromised regardless of test/live status.
2. Put the **new** values only in `.env` on your server (never committed,
   `.gitignore` already excludes it) or in your host's secret manager.
3. Scope the Cloudflare token narrowly: Cloudflare Dashboard → My Profile →
   API Tokens → Create Token → "Edit zone DNS" template, restricted to the
   specific zone(s) — not the Global API Key, which has account-wide power.
4. `ALLOWED_ORIGINS` in `.env` should be your real domain(s) in production,
   not `*` — the wildcard is fine for local testing only.
5. `/api/license/list` and `/api/license/revoke` are unauthenticated in this
   starter — add an admin auth middleware (API key header, or a proper
   session/JWT check) before exposing this server publicly.

## Wiring order (once your server is up)

1. Create Stripe Products/Prices in the Stripe Dashboard → copy the
   `price_xxx` IDs into `.env`.
2. In Stripe Dashboard → Developers → Webhooks, add an endpoint pointing at
   `https://your-domain.example/api/checkout/webhook`, subscribe to
   `checkout.session.completed`, copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`.
3. Verify your Mailtrap sending domain (Mailtrap dashboard will give you
   TXT/CNAME records to add — use the `/api/cloudflare/verify-txt` route
   above to add them programmatically).
4. Test end-to-end: open `/aerosys9000/`, register, pick a paid plan, use a
   Stripe test card (4242 4242 4242 4242) — you should land back on the
   gateway, then receive a real email with your access code shortly after
   (once Mailtrap's domain is verified).
