#!/usr/bin/env bash
# deploy.sh — One-command deploy to Vercel + DNS setup for all 4 domains.
#
# Prerequisites on YOUR machine:
#   npm install -g vercel
#
# Usage:
#   export VERCEL_TOKEN="your-token"                    # from vercel.com/account/tokens
#   export CLOUDFLARE_API_TOKEN="your-rotated-token"
#   export CLOUDFLARE_ZONE_ID_AEROSYS="zone-id"        # from CF dashboard, not a secret
#   export CLOUDFLARE_ZONE_ID_MACROSOFT="zone-id"
#   export TARGET_IP="$(curl -s ifconfig.me)"           # or your fixed server IP
#   bash deploy.sh

set -euo pipefail

: "${VERCEL_TOKEN:?Set VERCEL_TOKEN}"
: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ZONE_ID_AEROSYS:?Set CLOUDFLARE_ZONE_ID_AEROSYS}"
: "${CLOUDFLARE_ZONE_ID_MACROSOFT:?Set CLOUDFLARE_ZONE_ID_MACROSOFT}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Step 1: Deploy to Vercel (aerosys-host) ==="
cd "$SCRIPT_DIR"
vercel --prod --token="$VERCEL_TOKEN" --yes

echo ""
echo "=== Step 2: Add custom domains to Vercel project ==="
# aerosys.aero domains
vercel domains add aerosys-host.vercel.app webservices.aerosys.aero --token="$VERCEL_TOKEN" || true
vercel domains add aerosys-host.vercel.app portal.aerosys.aero --token="$VERCEL_TOKEN" || true
# macro-soft.com domains
vercel domains add aerosys-host.vercel.app webservices.macro-soft.com --token="$VERCEL_TOKEN" || true
vercel domains add aerosys-host.vercel.app portal.macro-soft.com --token="$VERCEL_TOKEN" || true

echo ""
echo "=== Step 3: Configure DNS in Cloudflare for all 4 domains ==="

CF="https://api.cloudflare.com/client/v4"
AUTH=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")

# Vercel uses CNAME to cname.vercel-dns.com for custom domains
VERCEL_CNAME="cname.vercel-dns.com"

create_record() {
  local zone="$1" name="$2"
  echo "  → CNAME $name → $VERCEL_CNAME"
  curl -sS -X POST "$CF/zones/$zone/dns_records" \
    "${AUTH[@]}" \
    --data "{\"type\":\"CNAME\",\"name\":\"$name\",\"content\":\"$VERCEL_CNAME\",\"ttl\":3600,\"proxied\":false}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('    ✓ created' if d.get('success') else '    ✗ '+str(d.get('errors')))"
}

create_record "$CLOUDFLARE_ZONE_ID_AEROSYS"   "webservices.aerosys.aero"
create_record "$CLOUDFLARE_ZONE_ID_AEROSYS"   "portal.aerosys.aero"
create_record "$CLOUDFLARE_ZONE_ID_MACROSOFT"  "webservices.macro-soft.com"
create_record "$CLOUDFLARE_ZONE_ID_MACROSOFT"  "portal.macro-soft.com"

echo ""
echo "=== Step 4: Register Stripe webhook ==="
echo "  Manual step — go to:"
echo "  https://dashboard.stripe.com/webhooks/create"
echo "  URL: https://aerosys-host.vercel.app/api/webhook/stripe"
echo "  Events: checkout.session.completed"
echo "  Copy the signing secret → add as STRIPE_WEBHOOK_SECRET in Vercel env vars"

echo ""
echo "=== Step 5: Verify Mailtrap sending domain ==="
echo "  Run after deploy: see mailtrap-verify.sh (generated below)"

echo ""
echo "=== Done ==="
echo "  https://aerosys-host.vercel.app          → Suite home"
echo "  https://aerosys-host.vercel.app/aerosys9000/    → AeroSys 9000"
echo "  https://aerosys-host.vercel.app/mission-control/ → Mission Control"
echo "  https://aerosys-host.vercel.app/rtos/           → RTOS"
echo ""
echo "  Custom domains (live within minutes once DNS propagates):"
echo "  https://webservices.aerosys.aero"
echo "  https://portal.aerosys.aero"
echo "  https://webservices.macro-soft.com"
echo "  https://portal.macro-soft.com"
