// sunday-push-scheduler — Edge Function (architecture §04, US-007).
//
// Cron-invoked (Upstash QStash, Sunday 07:00 UTC), NOT user-invoked. Sends one
// personalised Sunday push per eligible user. Cost discipline (AGENTS.md / §05):
// GPT-4o-mini fires ONLY for the 4+ expiring-items case; everything else is a
// zero-AI string template. The 0-expiring case sends NOTHING (US-007), except the
// "no scan in 2+ weeks" gentle nudge.
//
// Auth: this function has no user JWT. The caller must present the shared secret
// header `x-cron-secret`. It then uses the SERVICE ROLE key to read across all
// users (the one function that must) — so it must never be exposed without the
// secret.
//
// Secrets (server-side env vars only): CRON_SECRET, ONESIGNAL_APP_ID,
// ONESIGNAL_REST_API_KEY, OPENAI_API_KEY, POSTHOG_API_KEY, POSTHOG_HOST (optional),
// SENTRY_DSN (optional). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EXPIRY_WINDOW_DAYS = 7;
const STALE_SCAN_DAYS = 14; // "hasn't scanned in 2+ weeks" → gentle nudge
const SEND_CONCURRENCY = 25; // pragmatic "batch" — concurrent sends, capped
const ONESIGNAL_URL = 'https://onesignal.com/api/v1/notifications';
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

type Variant = 'template' | 'ai' | 'nudge';

interface UserRow {
  id: string;
  onesignal_id: string | null;
  notification_prefs: { sunday_push?: boolean } | null;
  last_scan_at: string | null;
}

/** A ready-to-send push (null plan = skip the user, no send). */
interface SendPlan {
  userId: string;
  onesignalId: string;
  message: string;
  variant: Variant;
  itemCount: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function utcDateOnly(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 86_400_000;
}

/** Join up to three names like "X", "X & Y", "X, Y & Z". */
function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]}, ${names[1]} & ${names[2]}`;
}

function templateMessage(names: string[], total: number): string {
  const head = joinNames(names.slice(0, 3));
  const verb = names.length === 1 && total === 1 ? 'expires' : 'expire';
  const more = total > 3 ? ` (and ${total - 3} more)` : '';
  return `${head}${more} ${verb} this week.`;
}

// ── GPT-4o-mini one-line hook — 4+ items ONLY (the single AI call) ────────────
async function generateHook(names: string[]): Promise<string | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('sunday-push: OPENAI_API_KEY not set; using template fallback');
    return null;
  }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 40,
        messages: [
          {
            role: 'system',
            content:
              'You write ONE short, warm push-notification line (max ~12 words) nudging ' +
              'someone to cook before food expires. Plain text, one line, no quotes, no emojis.',
          },
          { role: 'user', content: `These items expire within the week: ${names.join(', ')}. Write one line.` },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`sunday-push: OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    const raw = String(data.choices?.[0]?.message?.content ?? '').trim();
    const oneLine = raw.replace(/\s+/g, ' ').replace(/^["']|["']$/g, '').trim();
    return oneLine.length > 0 ? oneLine.slice(0, 140) : null;
  } catch (e) {
    console.error(`sunday-push: OpenAI threw: ${String(e)}`);
    return null;
  }
}

// ── PostHog: delivery event (open-rate tracking) ──────────────────────────────
async function postHogCapture(userId: string, props: Record<string, unknown>): Promise<void> {
  const apiKey = Deno.env.get('POSTHOG_API_KEY');
  if (!apiKey) return; // analytics optional — never block a send
  const host = Deno.env.get('POSTHOG_HOST') ?? DEFAULT_POSTHOG_HOST;
  try {
    await fetch(`${host.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: 'sunday_push_sent',
        distinct_id: userId,
        properties: props,
      }),
    });
  } catch (e) {
    console.error(`sunday-push: PostHog capture failed: ${String(e)}`);
  }
}

// ── Sentry: log a OneSignal delivery failure (no SDK; minimal store API) ───────
async function sentryCapture(message: string, extra: Record<string, unknown>): Promise<void> {
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) {
    console.error(`sunday-push: ${message}`, extra);
    return;
  }
  try {
    // DSN: https://<key>@<host>/<project_id>
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) {
      console.error(`sunday-push: malformed SENTRY_DSN; ${message}`, extra);
      return;
    }
    const [, key, host, projectId] = m;
    await fetch(`https://${host}/api/${projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=hearth-edge/1.0, sentry_key=${key}`,
      },
      body: JSON.stringify({
        level: 'error',
        logger: 'sunday-push-scheduler',
        message,
        extra,
        platform: 'other',
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error(`sunday-push: Sentry capture failed (${message}): ${String(e)}`, extra);
  }
}

// ── OneSignal send with a single retry. Returns true on delivery acceptance. ──
async function sendOneSignal(plan: SendPlan, appId: string, restKey: string): Promise<boolean> {
  const body = JSON.stringify({
    app_id: appId,
    include_player_ids: [plan.onesignalId],
    headings: { en: 'Hearth' },
    contents: { en: plan.message },
    // Tap target — the client routes this to Home with expiry highlighted (US-007).
    data: { screen: 'home', highlight: 'expiring' },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(ONESIGNAL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${restKey}` },
        body,
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        // OneSignal reports unreachable recipients in `errors` even on HTTP 200.
        if (data && typeof data === 'object' && 'errors' in data && data.errors) {
          if (attempt === 1) {
            await sentryCapture('OneSignal delivery error', { userId: plan.userId, errors: data.errors });
            return false;
          }
          continue; // one retry
        }
        return true;
      }
      if (attempt === 1) {
        await sentryCapture('OneSignal HTTP error', {
          userId: plan.userId,
          status: res.status,
          bodyText: (await res.text()).slice(0, 300),
        });
        return false;
      }
    } catch (e) {
      if (attempt === 1) {
        await sentryCapture('OneSignal request threw', { userId: plan.userId, error: String(e) });
        return false;
      }
    }
  }
  return false;
}

/** Build the per-user send plan (or null to skip). Only the 4+ branch calls AI. */
async function buildPlan(
  supabase: ReturnType<typeof createClient>,
  user: UserRow,
  todayISO: string,
  windowEndISO: string
): Promise<SendPlan | null> {
  if (!user.onesignal_id) return null;
  if (user.notification_prefs?.sunday_push === false) return null; // Settings opt-out

  // Active items expiring within the next 7 days (not already expired), soonest first.
  const { data: rows } = await supabase
    .from('pantry_items')
    .select('expires_at, ingredient:ingredients(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('expires_at', todayISO)
    .lte('expires_at', windowEndISO)
    .order('expires_at', { ascending: true });

  const names: string[] = (rows ?? [])
    .map((r: { ingredient: { name: string } | null }) => r.ingredient?.name)
    .filter((n: string | undefined): n is string => !!n);
  const count = names.length;

  // N = 0 → send NOTHING, unless the pantry looks stale (US-007 edge case).
  if (count === 0) {
    const since = daysSince(user.last_scan_at);
    const stale = since === null || since >= STALE_SCAN_DAYS;
    if (!stale) return null;
    return {
      userId: user.id,
      onesignalId: user.onesignal_id,
      message: 'Your pantry might need updating — scan a receipt to keep your meals on track.',
      variant: 'nudge',
      itemCount: 0,
    };
  }

  // N = 1–3 → zero-AI template.
  if (count <= 3) {
    return {
      userId: user.id,
      onesignalId: user.onesignal_id,
      message: templateMessage(names, count),
      variant: 'template',
      itemCount: count,
    };
  }

  // N ≥ 4 → ONE GPT-4o-mini hook; template fallback on any AI failure (no 2nd call).
  const hook = await generateHook(names);
  return {
    userId: user.id,
    onesignalId: user.onesignal_id,
    message: hook ?? templateMessage(names, count),
    variant: hook ? 'ai' : 'template',
    itemCount: count,
  };
}

/** Run an async mapper over items with a bounded concurrency. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Required configuration.
  const cronSecret = Deno.env.get('CRON_SECRET');
  const appId = Deno.env.get('ONESIGNAL_APP_ID');
  const restKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!cronSecret || !appId || !restKey || !serviceKey || !supabaseUrl) {
    console.error('sunday-push: missing required env vars');
    return json({ error: 'misconfigured' }, 500);
  }

  // Authenticate the cron caller via shared secret.
  if (req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    // Service-role client — bypasses RLS to read across all users.
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: users, error } = await supabase
      .from('users')
      .select('id, onesignal_id, notification_prefs, last_scan_at')
      .not('onesignal_id', 'is', null)
      .eq('onboarding_complete', true);
    if (error) {
      console.error(`sunday-push: user query failed: ${error.message}`);
      return json({ error: 'query_failed' }, 500);
    }

    const now = new Date();
    const todayISO = utcDateOnly(now);
    const windowEndISO = utcDateOnly(new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 86_400_000));

    // Build plans (this is where the 4+ AI calls happen), then drop skips.
    const plans = (
      await mapWithConcurrency(
        (users ?? []) as UserRow[],
        SEND_CONCURRENCY,
        (u) => buildPlan(supabase, u, todayISO, windowEndISO)
      )
    ).filter((p): p is SendPlan => p !== null);

    // Batch the sends; log delivery to PostHog, failures to Sentry (≤1 retry).
    let sent = 0;
    let failed = 0;
    await mapWithConcurrency(plans, SEND_CONCURRENCY, async (plan) => {
      const ok = await sendOneSignal(plan, appId, restKey);
      if (ok) {
        sent++;
        await postHogCapture(plan.userId, { variant: plan.variant, item_count: plan.itemCount });
      } else {
        failed++;
      }
    });

    return json({
      ok: true,
      eligible_users: users?.length ?? 0,
      planned: plans.length,
      sent,
      failed,
      skipped: (users?.length ?? 0) - plans.length,
    });
  } catch (e) {
    console.error(`sunday-push: internal: ${String(e)}`);
    return json({ error: 'internal' }, 500);
  }
});
