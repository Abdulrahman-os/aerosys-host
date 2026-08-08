#!/usr/bin/env bash
# mailtrap-verify.sh — Adds the TXT/CNAME records that Mailtrap requires
# to verify webservices.aerosys.aero as an authorized sending domain.
#
# Run AFTER deploy.sh. Mailtrap will give you the exact record values in:
# Mailtrap → Email Sending → Domains → Add Domain → webservices.aerosys.aero
# Copy those values into the variables below, then run this script.
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="your-rotated-token"
#   export CLOUDFLARE_ZONE_ID_AEROSYS="zone-id-for-aerosys.aero"
#   # Fill in the values Mailtrap shows you:
#   export MAILTRAP_DKIM_NAME="mailtrap._domainkey.webservices.aerosys.aero"
#   export MAILTRAP_DKIM_VALUE="v=DKIM1; k=rsa; p=..."
#   export MAILTRAP_SPF_VALUE="v=spf1 include:_spf.mailtrap.io ~all"
#   bash mailtrap-verify.sh

set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ZONE_ID_AEROSYS:?Set CLOUDFLARE_ZONE_ID_AEROSYS}"
: "${MAILTRAP_DKIM_NAME:?Set MAILTRAP_DKIM_NAME (from Mailtrap dashboard)}"
: "${MAILTRAP_DKIM_VALUE:?Set MAILTRAP_DKIM_VALUE (from Mailtrap dashboard)}"
: "${MAILTRAP_SPF_VALUE:=v=spf1 include:_spf.mailtrap.io ~all}"

CF="https://api.cloudflare.com/client/v4"
AUTH=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")
ZONE="$CLOUDFLARE_ZONE_ID_AEROSYS"

add_txt() {
  local name="$1" value="$2"
  echo "→ TXT $name"
  curl -sS -X POST "$CF/zones/$ZONE/dns_records" \
    "${AUTH[@]}" \
    --data "{\"type\":\"TXT\",\"name\":\"$name\",\"content\":\"$value\",\"ttl\":300}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✓ created' if d.get('success') else '  ✗ '+str(d.get('errors')))"
}

echo "=== Adding Mailtrap domain verification records ==="
add_txt "webservices.aerosys.aero"  "$MAILTRAP_SPF_VALUE"
add_txt "$MAILTRAP_DKIM_NAME"       "$MAILTRAP_DKIM_VALUE"

echo ""
echo "Records added. Now go to Mailtrap → Domains → Verify."
echo "May take a few minutes for DNS to propagate."
