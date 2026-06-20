# sunday-push-scheduler

Personalised Sunday push notification for every eligible user (architecture §04,
US-007). **Cron-invoked** by Upstash QStash every Sunday at **07:00 UTC** — it is
not called from the app.

## What it does

1. Reads `users WHERE onesignal_id IS NOT NULL AND onboarding_complete = true`
   (service-role; the one function that reads across users).
2. Skips anyone who turned Sunday push **off** (`notification_prefs.sunday_push = false`).
3. For each remaining user, counts active pantry items expiring within 7 days and
   branches — **AI fires only for the 4+ case** (cost rule, AGENTS.md / §05):

   | Expiring items | Message | AI? |
   | --- | --- | --- |
   | 0, scanned < 14 days ago | _(nothing — no send)_ | no |
   | 0, no scan in 14+ days | "Your pantry might need updating…" (gentle nudge) | no |
   | 1–3 | "Tofu, spinach & milk expire this week." (template) | no |
   | 4+ | one personalised GPT-4o-mini hook line (template fallback on failure) | **yes (1 call)** |

4. Sends are batched (bounded concurrency) to OneSignal. Each carries deep-link
   data `{ screen: "home", highlight: "expiring" }`, so tapping opens Home with the
   expiry items highlighted.
5. Every delivery is logged to **PostHog** (`sunday_push_sent`) for open-rate
   tracking. A failed OneSignal delivery is retried **once**, then logged to
   **Sentry** — never retried again, never spamming the user.

## Auth model

No Supabase JWT (`verify_jwt = false`, see `supabase/config.toml`). The caller must
send the shared secret header **`x-cron-secret`** matching the `CRON_SECRET` env var.
Wrong/missing secret → `401`.

## Required secrets

Set these on the Supabase project (server-side only — never in the app bundle):

```bash
supabase secrets set \
  CRON_SECRET="$(openssl rand -hex 32)" \
  ONESIGNAL_APP_ID="your-onesignal-app-id" \
  ONESIGNAL_REST_API_KEY="your-onesignal-rest-api-key" \
  OPENAI_API_KEY="sk-..." \
  POSTHOG_API_KEY="phc_..." \
  POSTHOG_HOST="https://us.i.posthog.com" \
  SENTRY_DSN="https://...ingest.sentry.io/..."
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
`POSTHOG_HOST` and `SENTRY_DSN` are optional (analytics / error logging degrade to
`console` if absent). `OPENAI_API_KEY` is only used for the 4+ branch.

## Schedule it (Upstash QStash)

Run the helper (needs `QSTASH_TOKEN` and the same `CRON_SECRET` you set above):

```bash
QSTASH_TOKEN=... CRON_SECRET=... ./scripts/setup-sunday-cron.sh
```

It creates a QStash schedule with cron `0 7 * * 0` that POSTs to the deployed
function and forwards the `x-cron-secret` header. See the script for the raw curl.

## Test manually

```bash
# Wrong secret → 401
curl -i -X POST "$FUNCTION_URL" -H "x-cron-secret: nope" -d '{}'

# Correct secret → runs the batch, returns a summary
curl -s -X POST "$FUNCTION_URL" -H "x-cron-secret: $CRON_SECRET" -d '{}'
# → {"ok":true,"eligible_users":N,"planned":M,"sent":M,"failed":0,"skipped":N-M}
```
