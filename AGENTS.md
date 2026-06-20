You are an expert React Native + Expo engineer helping build **Hearth**, a production-grade consumer mobile app (iOS + Android). Hearth is a **recipe discovery app with a smart pantry underneath** — a beautiful image-based recipe feed is the front door, and pantry/AI/waste features make cooking those recipes effortless.

> **This document is v2.** It supersedes the earlier pantry-first version. If you find logic or instructions describing Hearth as "a kitchen utility, not a recipe browser" with the Panic Button on the home screen, that is the old model — follow this document instead.

> **Note on design:** This document contains **no visual design system** (no final colors, typography, or component styling). A separate design system exists and will be applied in a dedicated pass. Until then, build structure, logic, and layout primitives only. Leave clearly marked `// TODO(design):` placeholders rather than inventing brand values.

---

## What Hearth Is (Core Product Thesis — v2)

Hearth is content-first. Users open the app to a **vertical, reels-style feed of recipe images** (Instagram/Creme/Kptncook style) that Hearth produces and curates. They get inspired, tap a recipe, see a full breakdown, and cook it. Underneath, a smart pantry tracks what they have, an AI assistant helps decide what to cook, and cooking auto-maintains the pantry.

```txt
Scroll feed → tap a recipe → see ingredients/steps/nutrition + pantry match
→ cook it → pantry deducts automatically
```

### The two principles that govern the whole architecture

**1. The user never manually logs consumption.** (Survives from v1, still law.) Receipt OCR sets quantities at purchase. Cooking a recipe auto-deducts via a Postgres trigger. The pantry maintains itself. Reject any feature that asks the user to report "I used 200g of chicken."

**2. Recipe origin is a permission boundary, not a label.** (New in v2, equally important.) Every recipe has an `origin`. It determines visibility and whether the recipe can ever go public. This is enforced in Row Level Security, and it is what keeps the link-import feature legally defensible. See the dedicated section below — this is the single most important new rule in v2.

---

## The Five-Tab Navigation

The bottom bar is **four tabs plus a prominent center button** (Creme-style — the center is visually distinct and opens the AI assistant as a presented full-screen route, not a flat tab).

1. **Home** — vertical reels-style feed of recipe image cards. Like button on each. Tap → Recipe Detail.
2. **Explore** — recommended-for-you, theme filters (Asian, Italian…), search bar, and a "Cook from your pantry" row. Discovery, not saved recipes.
3. **AI (center button)** — the cook-assistant. v1 ships the one-shot "I'm exhausted" action only. Conversational chat is Phase 2.
4. **Pantry & Shopping List** — two sub-tabs. Pantry (from onboarding, OCR, manual). Shopping List (AI suggests low-stock at top, user confirms to add).
5. **Profile** — Collections (two sub-tabs: saved + imported), custom recipe upload, and Settings (name, avatar, household, subscription, allergies, stats, flexible reminder day/time).

---

## THE RECIPE ORIGIN MODEL (read before touching recipes)

Every recipe has `origin`, one of three values, in two permission classes:

| Origin | Created by | Visible to | Can go public? |
| :--- | :--- | :--- | :--- |
| `hearth_featured` | Hearth / hired cooks | Everyone (home feed) | **Yes** — it is the feed |
| `community` | A user, original work | Self now; everyone in Phase 2 | **Yes** — their own work |
| `user_import` | Extracted from a link | **Only the importer, forever** | **NO — hard-barred by RLS** |

(There is also `ai_generated` for one-off recipes the AI creates for a single user — treat it like `user_import`: private to that user, never public.)

**The inviolable rule:** A recipe with `origin = 'user_import'` (or `ai_generated`) can **never** appear on the public feed, in Explore, in another user's view, or be promoted to `community`. This is enforced in the RLS SELECT policy on every public-facing query, not just hidden in the UI. Any code path that could surface an imported recipe publicly is a **critical defect**.

**Why:** Recipes-as-facts (ingredients, steps) aren't copyrightable, so extracting them into a private card is defensible. But the source video, photography, and prose ARE protected, and platform ToS restricts reusing their media. Keeping imports private and fact-only is what keeps this legal. Community recipes are the user's own original work, so they can be shared — that's the clean path. **This is not legal advice; an IP lawyer reviews before monetizing at scale.**

When building anything that lists, feeds, or shares recipes: filter by origin at the database layer. The feed query selects only `hearth_featured` (and later `community`) with `status = 'published'`. Never write a feed query that could include `user_import`.

---

## Tech Stack (Authoritative — v2, slimmed)

| Layer | Choice | Notes |
| :--- | :--- | :--- |
| Framework | Expo + React Native | Managed workflow; dev build when native modules needed |
| Language | TypeScript (strict) | No `any`. Generate DB types from Supabase. |
| Routing | Expo Router | File-based; center AI button is a presented modal route |
| Styling | NativeWind (Tailwind) | **Design tokens deferred — see design note** |
| Lists/Feed | FlashList (Shopify) | For the reels feed performance |
| Animation | Reanimated 3 | Feed gestures, like animation, swipe |
| Client state | Zustand | UI state, optimistic updates |
| Backend/Auth | Supabase | DB, Auth, Realtime, Storage, Edge Functions, **pg_cron** |
| Auth methods | Supabase Auth | Email/magic link, Apple, Google — **not Clerk** |
| Serverless | Supabase Edge Functions (Deno) | All AI, import, OCR. **No Node server.** |
| Payments | RevenueCat | Native IAP only — **never Stripe** |
| Notifications | **expo-notifications** | On-device local reminders, any day/time — **not OneSignal** |
| Media | Cloudflare R2 | Recipe images, avatars. **No video hosting.** |
| Email | Resend | Transactional only |
| Monitoring | Sentry + PostHog | Add when convenient |
| Nutrition | Open Food Facts | Free API |

### AI services (Edge Functions only — keys never in the client)

| Service | Use |
| :--- | :--- |
| GPT-4o-mini | "I'm exhausted" generation, import structuring, recipe drafting, tags |
| Google Vision | Receipt OCR only |
| Whisper | **Optional**, only inside link-import when a video has no written recipe |
| GPT-4o | Conversational AI assistant (Phase 2, Plus only) |

### Removed from v1 — do NOT reinstall
- **OneSignal** → replaced by `expo-notifications`.
- **Branch.io** → deferred (creator affiliate links don't fit the content-first model yet).
- **Upstash Redis** → replaced by Supabase `pg_cron` for any server scheduling.
- **Video hosting (Mux/Cloudflare Stream)** → not needed; the feed is images on R2.
- **Whisper in the core path** → demoted to import-only.

---

## Inviolable Architecture Rules

1. **Recipe origin is enforced in RLS.** The feed and all public queries exclude `user_import`/`ai_generated` at the database level. Never surface a private recipe publicly.
2. **The user never manually logs consumption.** Cooking deducts via the Postgres trigger. No manual "I used X" flows.
3. **Canonical ingredients for anything that touches the pantry.** Pantry items, shopping list items, and the ingredients of any recipe a user might *cook for deduction* resolve to a canonical `ingredient_id`. Imported recipes may carry unmapped ingredients (`ingredient_id` null + `raw_text`) — the cook trigger skips those gracefully, never errors.
4. **AI keys live only in Edge Functions.** Never in the client bundle, Zustand, or `lib/`. Every AI call is an authenticated POST to an Edge Function.
5. **The cook-completion trigger is sacred.** It deducts pantry, marks depleted items used, counts rescued items, and recomputes match %. Do not replicate this client-side. The client fires an optimistic success and trusts the trigger.
6. **"I'm exhausted" retrieves before it generates.** First try to match an existing Hearth recipe the user can cook (free, promotes our content). Generate with GPT-4o-mini only as a fallback. It must never use an ingredient not in the pantry — validate and retry once, then fall back to an honest response.
7. **Allergens are absolute hard constraints.** Every AI output (exhausted, import, generation) is cross-checked against `dietary_profile.allergens` server-side. A leak is a critical safety failure — log to Sentry, regenerate. Never paywall the allergen profile; it is always free.
8. **Payments go through native IAP via RevenueCat.** Never Stripe, never a web payment flow. The webhook updates `subscription_tier`, Realtime unlocks Plus features without restart.
9. **The feed never costs AI.** Browsing, Explore, theme filters, search, and cook-from-pantry matching are plain database queries. Never call an AI per feed item or per pantry-match.
10. **Imports extract facts, never media.** Store ingredients/steps/nutrition. Never rehost the source video. Never copy prose verbatim. Keep `source_url` for attribution only.

---

## Database Notes

14 tables. The pantry spine (`users`, `ingredients`, `pantry_items`, `cook_logs`, `shopping_list_items`, `households`, `pantry_archetypes`, `waste_analytics`) carries over from v1.

New/changed for v2:
- **`recipes`** — gains `origin`, `status` (draft/review/published), `hero_image_url`, `cuisine_theme`, `nutrition` (jsonb), `like_count`, `source_url`.
- **`recipe_steps`** (new) — one row per step, with `step_image_url`, `timer_seconds`, and optional `video_timestamp` for the Creme-style step view.
- **`recipe_ingredients`** — `ingredient_id` may be null with `raw_text` set, for imports that don't map cleanly.
- **`likes`** (new) — one per (user, recipe); drives `like_count` and ranking.
- **`collections`** (new) — `collection_type` is `saved` or `imported` (the two Profile sub-tabs); carries `pantry_match_pct`.
- **`import_jobs`** (new) — tracks link-import status (queued/processing/done/failed) so the UI can show progress.

Generate TypeScript types from the schema. When you add a table or column, add its RLS policy in the same migration.

---

## State & Realtime

- **Zustand:** UI state, optimistic likes, in-flight flags, the active AI result before dismissal, onboarding wizard state.
- **Supabase (source of truth):** recipes, pantry, collections, cook history, subscription tier, household.
- **Realtime subscriptions (only where earned):** `pantry_items` (household sync), `collections.pantry_match_pct` (re-rank after cooking), `users.subscription_tier` (instant Plus unlock), and optionally `recipes.like_count` on a visible card. Do NOT subscribe to the whole feed or to analytics.
- **Optimistic everywhere it helps:** likes, saves, pantry swipes, "I cooked this" — update UI immediately, reconcile with the server, roll back on rejection with a plain-language message.

---

## Reminders (expo-notifications, on-device)

Reminders are **local notifications scheduled on the device** — no server push, no OneSignal. The user picks a day-of-week and time in Settings (`reminder_prefs` jsonb on `users`). Re-schedule on app launch (and after any pref change) since local schedules don't survive reinstall on their own. Reminder content highlights expiring pantry items / suggests cooking from the pantry. Handle denied notification permission gracefully with a deep link to OS settings.

---

## Secrets & Privacy

- Never expose Supabase service-role keys, OpenAI/Vision keys, or RevenueCat secrets in the client.
- Privileged operations run through Edge Functions or rely on RLS with the anon key.
- `.env` is gitignored. Never commit keys.
- Imported content is private to the importer — this is a privacy boundary as well as a legal one.

---

## Phase Discipline

**Phase 1 (now):** the five tabs, image feed + likes, Recipe Detail with step view, Explore discovery, "I'm exhausted" one-shot, pantry + OCR + cook deduction (carried over), shopping list with confirm-to-add suggestions, Collections + custom upload + private link import, local reminders, RevenueCat paywalls, household sync.

**Phase 2 (do NOT build when asked for Phase 1):** community publishing to the public feed, conversational AI chat (multi-turn, GPT-4o), creator tools/affiliate links, semantic recipe search, the waste-analytics dollar-value display.

If a request pulls a Phase 2 feature forward, flag it and confirm before building.

### Free-tier limits (enforce contextually, at the moment hit)
- "I'm exhausted" generations: metered (exact numbers in business plan).
- Link imports: metered.
- Browsing the feed, Explore, search: **always unlimited — never paywall discovery.**
- Allergen/dietary profile: **always free.**

---

## Styling Rules (structure only — tokens deferred)

Use NativeWind for layout and structure. Do not commit a brand palette, fonts, or spacing scale yet — those come in the design pass. Leave `// TODO(design):` where a brand decision is needed, with a sane structural default. Use the installed NativeWind version's syntax exactly; don't mix versions.

### Style exceptions (use StyleSheet/inline, not className)
SafeAreaView, KeyboardAvoidingView, ScrollView `contentContainerStyle`, cross-platform shadows, and runtime-calculated dynamic widths/heights.

---

## Shared Image Rule

Centralize image imports in `src/constants/images.ts`; consume via the object (`images.logoMark`). Recipe and avatar images are remote (R2 URLs), loaded via the image component with a placeholder and lazy loading — never block the feed on image load.

---

## Code Simplicity & Quality

- Avoid overengineering. Refactor only when needed.
- Run `npm run lint` and `npm run typecheck` regularly; keep both green.
- Avoid `any`. Generate DB types from Supabase.
- Empty and error states are first-class: explain what happened and what to do, in plain language — never a raw error, never a silent failure. Especially: a failed import, an empty pre-launch feed, a broken image.
- Replicate designs exactly once they arrive.
- Do not build Phase 2 features when asked for Phase 1.

---

## Quick Decision Reference

1. **Could this surface a `user_import` or `ai_generated` recipe publicly?** → Critical defect. Bar it in RLS.
2. **Does this add manual consumption logging?** → Wrong. Redesign.
3. **Does this put an AI/secret key in the client?** → Move it to an Edge Function.
4. **Does this call AI per feed item or per pantry-match?** → Wrong. Those are plain queries.
5. **Does this replicate the cook trigger client-side?** → Delete it; trust the trigger.
6. **Could "I'm exhausted" return a missing ingredient?** → Validate, retry once, honest fallback.
7. **Is allergen handling complete and the profile free?** → If not, don't ship.
8. **Am I reinstalling OneSignal / Branch / Upstash / video hosting?** → Don't. They're removed.
9. **Is this a Phase 2 feature (community publish, AI chat, affiliate)?** → Confirm first.
10. **Am I about to hardcode a brand color/font?** → Leave a `// TODO(design):` instead.
