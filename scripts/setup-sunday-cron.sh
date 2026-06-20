#!/usr/bin/env bash
#
# Create (or update) the Upstash QStash schedule that fires the Sunday push every
# Sunday at 07:00 UTC. QStash POSTs to the deployed sunday-push-scheduler Edge
# Function and forwards the x-cron-secret header it expects (Upstash-Forward-*).
#
# Prereqs:
#   - The function is deployed (supabase functions deploy sunday-push-scheduler).
#   - Its secrets are set (see supabase/functions/sunday-push-scheduler/README.md),
#     including CRON_SECRET — pass the SAME value here.
#
# Usage:
#   QSTASH_TOKEN=... CRON_SECRET=... ./scripts/setup-sunday-cron.sh
#
# Optional overrides:
#   FUNCTION_URL  (defaults to the project's deployed function URL below)
#   CRON          (defaults to "0 7 * * 0" — Sunday 07:00 UTC)
set -euo pipefail

FUNCTION_URL="${FUNCTION_URL:-https://rzhgqstebywsfzxlkxcr.supabase.co/functions/v1/sunday-push-scheduler}"
CRON="${CRON:-0 7 * * 0}"

: "${QSTASH_TOKEN:?Set QSTASH_TOKEN (Upstash QStash token)}"
: "${CRON_SECRET:?Set CRON_SECRET (must match the function's CRON_SECRET secret)}"

echo "Creating QStash schedule:"
echo "  destination : $FUNCTION_URL"
echo "  cron        : $CRON  (UTC)"

# QStash forwards any header prefixed Upstash-Forward-* to the destination with the
# prefix stripped — so the function receives a plain `x-cron-secret` header.
curl -fsS -X POST "https://qstash.upstash.io/v2/schedules/${FUNCTION_URL}" \
  -H "Authorization: Bearer ${QSTASH_TOKEN}" \
  -H "Upstash-Cron: ${CRON}" \
  -H "Upstash-Forward-x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{}'

echo
echo "Done. Manage schedules at https://console.upstash.com/qstash"
