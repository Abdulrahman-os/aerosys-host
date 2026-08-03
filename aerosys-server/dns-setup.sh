#!/usr/bin/env bash
# dns-setup.sh — Configures real DNS records for the 4 production domains
# via Cloudflare's API. Run this ON YOUR OWN MACHINE/SERVER with your real
# (rotated) Cloudflare token exported as an env var — never paste the token
# into this file.
#
# Domains covered:
#   webservices.macro-soft.com  → Macro-Soft landing page
#   portal.macro-soft.com       → Macro-Soft industry portal
#   webservices.aerosys.aero    → AeroSys landing page
#   portal.aerosys.aero         → AeroSys company portal
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="cfat_..."          # your ROTATED token
#   export CLOUDFLARE_ZONE_ID_MACROSOFT="..."        # zone ID for macro-soft.com
#   export CLOUDFLARE_ZONE_ID_AEROSYS="..."          # zone ID for aerosys.aero
#   export TARGET_IP="203.0.113.10"                  # your server's public IP
#   # OR, if pointing at another host (e.g. a load balancer), use TARGET_CNAME instead:
#   # export TARGET_CNAME="your-server.example.com"
#
#   chmod +x dns-setup.sh
#   ./dns-setup.sh
#
# Find your Zone IDs in Cloudflare Dashboard → select domain → right sidebar
# "API" section → Zone ID. Do this once per apex domain (macro-soft.com,
# aerosys.aero) — subdomains share the same zone as their apex.

set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN before running this script}"
: "${CLOUDFLARE_ZONE_ID_MACROSOFT:?Set CLOUDFLARE_ZONE_ID_MACROSOFT before running this script}"
: "${CLOUDFLARE_ZONE_ID_AEROSYS:?Set CLOUDFLARE_ZONE_ID_AEROSYS before running this script}"

if [[ -z "${TARGET_IP:-}" && -z "${TARGET_CNAME:-}" ]]; then
  echo "Set either TARGET_IP (for an A record) or TARGET_CNAME (for a CNAME record)." >&2
  exit 1
fi

RECORD_TYPE="A"
RECORD_VALUE="${TARGET_IP:-}"
if [[ -n "${TARGET_CNAME:-}" ]]; then
  RECORD_TYPE="CNAME"
  RECORD_VALUE="${TARGET_CNAME}"
fi

create_record() {
  local zone_id="$1" name="$2"
  echo "→ Creating ${RECORD_TYPE} record: ${name} → ${RECORD_VALUE}"
  curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"${RECORD_TYPE}\",\"name\":\"${name}\",\"content\":\"${RECORD_VALUE}\",\"ttl\":3600,\"proxied\":true}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✓ success' if d.get('success') else '  ✗ FAILED: '+str(d.get('errors')))"
}

echo "=== Macro-Soft domains (zone: ${CLOUDFLARE_ZONE_ID_MACROSOFT}) ==="
create_record "$CLOUDFLARE_ZONE_ID_MACROSOFT" "webservices.macro-soft.com"
create_record "$CLOUDFLARE_ZONE_ID_MACROSOFT" "portal.macro-soft.com"

echo "=== AeroSys domains (zone: ${CLOUDFLARE_ZONE_ID_AEROSYS}) ==="
create_record "$CLOUDFLARE_ZONE_ID_AEROSYS" "webservices.aerosys.aero"
create_record "$CLOUDFLARE_ZONE_ID_AEROSYS" "portal.aerosys.aero"

echo ""
echo "Done. DNS propagation is usually fast with Cloudflare (minutes), but"
echo "allow up to 24-48h for full global propagation. Verify with:"
echo "  dig webservices.macro-soft.com"
echo "  dig portal.aerosys.aero"
