# KWAC Architecture Reference

Dense reference for fast context-loading — read this before exploring the codebase manually. Update it whenever a change alters something below (new table, new AI surface, a schema-drift fix, etc.) rather than leaving it stale.

## Stack

Next.js 14 App Router + TypeScript, Supabase (Postgres + Auth + Storage), Tailwind, deployed on Vercel. No ORM — `@supabase/supabase-js` directly. Two client patterns per route:
- **Browser client** (`lib/supabase.ts`, anon key): RLS-enforced, used in client components. Trust RLS, not app logic, for isolation.
- **Service-role client** (most `app/api/**/route.ts`): bypasses RLS entirely. Every such route MUST derive `agency_id`/role from `getAuthedAgent(req)` (`lib/auth.ts`) — never trust a client-supplied `agency_id`/`agent_id`.

## ⚠️ Live schema drifts from migration files — verify before trusting

Migration files in `supabase/migrations/` are the source of truth for *new* changes, but the live DB has repeatedly disagreed with what old migration files claim (manual Supabase SQL-editor edits that never got backported into a migration). Confirmed instances this project has hit:
- `properties.price` doesn't exist (`price_asking`/`price_final` do) — broke the pricing engine, intelligence dashboard, backtest, and `top_producers_by_area` RPC simultaneously until fixed (migrations 023-024, `lib/intelligenceData.ts`, `lib/valuation.ts`).
- `meeting_valuations` was missing `blended_recommended`/`blended_confidence`/`feedback_count`/`last_feedback_sync` (migration 006 never landed) — every valuation save failed silently for a long time because the upsert's error wasn't checked (fixed migration 027).
- `contacts` has **two overlapping name schemes**: `first_name`+`last_name` (original data) and `full_name` (added later). Always go through `lib/contacts.ts`'s `contactName()`/`splitName()`, never assume one or the other is populated.
- `pipeline_properties.wp_id` had no unique constraint despite code assuming upsert-by-wp_id worked; `contacts.phone2` didn't exist despite being queried.
- `PropertyPhotoUpload` (`components/PropertyPhotoUpload.tsx`) uploaded and stored photos correctly, but never fetched existing ones on mount — only right after a fresh upload in that same session. Reopening a property looked like photos "don't save" when they were sitting in storage the whole time (fixed with a mount-time GET). Also had drop-zone styling with no `onDrop`/`onDragOver` handlers at all — drag-and-drop silently did nothing, only click-to-pick worked.

**When something looks broken despite the code/migration looking correct: query the live table directly (`curl` the Supabase REST API with the service-role key) before assuming the bug is elsewhere.**

## ⚠️ RLS policy drift — the same table can have a rogue permissive policy

Found (migration 031) 13 tables with an old, pre-multi-tenancy-hardening policy like `for all using (auth.role() = 'authenticated')` — or in one case (`open_houses`) no condition at all — coexisting with a proper agency/owner-scoped policy added later. **Postgres OR-combines permissive RLS policies for the same command**, so the rogue wide-open one alone grants full cross-tenant access regardless of how correct the other policy looks. This was invisible from migration files alone (the rogue policies were never captured in any file) and was only caught by **live-testing** an actual unauthorized request, not by code/policy review.

**If you add/change RLS on a table, verify it by actually attempting the denied operation with a real non-privileged account — don't just read the policy SQL and assume it's the only one active.** To list every policy actually on a table (there's no built-in way via PostgREST): temporarily create a `security definer` SQL function wrapping `select * from pg_policy where polrelid = '<table>'::regclass`, call it via RPC, then drop it (see migration 029→030 for the pattern).

## Data model — which "properties" table is which

- **`agencies`** — tenant. **`agents`** — staff (`role`: `agent`/`admin`/`ceo`; `admin`/`ceo` treated the same everywhere via `isCeoOrAdmin()`).
- **`contacts`** — people: sellers/landlords OR buyers/tenants. An "owner" is just a contact referenced by `meeting_properties.owner_contact_id` — not a separate table/role.
- **`meeting_properties`** — the agency's own live property pipeline, one row per property the agency is handling. Status flow: `pending` (private to the owning agent) → `for_appraisal` (promoted to shared "Meeting Ακινήτων" review) → `estimated` → `completed`. This is what Personal Admin and Meeting Ακινήτων both read, filtered differently (Personal Admin: `agent_id = you`; Meeting Ακινήτων: your own regardless of status, or anyone's once past `pending` — enforced by RLS, see migration 021).
- **`properties`** — comp/reference data: iList-imported listings (`price_asking`, sometimes `price_final`/`days_on_market`/`sold_at` once closed). Agency-scoped comps only — registry rows live in `market_transactions`, not here. Has `lat`/`lng` (populated on a handful of rows) and, as of migration 033, `balcony`/`utilization_score` (added for the NN pricing model, not yet backfilled on historical rows).
- **`market_transactions`** — real government transfer-registry data (Ministry of Finance "Μητρώο Αξιών Μεταβιβάσεων Ακινήτων", `lib/mamaRegistry.ts` + `app/api/market-data/import-registry`). **No `agency_id`** — deliberate exception to the multi-tenant rule, since this is national public reference data every tenant should see the same copy of. Supplements `properties` as a comp pool in the pricing engine; area-mapped via a curated dictionary (government uses formal municipality/district names, this app uses informal neighborhood names — unmapped rows are kept with `area: null`, not guessed).
- **`pipeline_properties`/`pipeline_events`** — separate, WordPress-sourced sync feed (zadeshome.com), unrelated to `meeting_properties`.
- **`meeting_valuations`** — one row per `meeting_properties.id`, the pricing engine's output (see below).
- **`meeting_comments`** — feedback on a valuation; write-only via `/api/meeting-comments` (direct client insert is RLS-denied on purpose), restricted to the property's area's top producers or admin.
- **`demand_profiles`** — buyer-side leads (not linked to `contacts` by FK, matched by phone/email when needed).
- **`marketing_campaigns`/`marketing_campaign_recipients`** — email/SMS campaign sends + click tracking (`/api/marketing/track`).
- **`ai_admin_usage_daily`/`ai_admin_actions_log`** — AI Admin chat's daily cap + full audit trail (every turn logged regardless of outcome).
- **`valuation_calibration_log`/`valuation_backtest_results`** — pricing engine audit trail (every blend logged; holdout backtest results).
- **`pricing_model_runs`** — one row per NN training run (weights as JSON, holdout accuracy, sample sizes); most recent `is_active=true` row per `agency_id` is what `meeting-valuation` loads. Old runs kept (not deleted) so accuracy trend over retrains is visible.

## Three distinct AI surfaces — do not conflate them

1. **Voice extraction** (`lib/voice/*`) — OpenAI Whisper (speech-to-text) + GPT-4o-mini (structured JSON extraction, `temperature: 0`). Used for property/demand voice notes (`/api/voice-transcribe`, `/api/voice-ingest`). Regex-based extraction is preferred over the LLM wherever possible (phone/email/price/size) — the LLM only fills fields regex can't get, to keep token spend down.
2. **AI Admin chat** (`lib/aiAdmin.ts`, `components/AiAdminChat.tsx`, `app/api/intelligence-chat`) — Anthropic Claude (Haiku 4.5, cost/speed over Sonnet since this is mostly short structured extraction + grounded Q&A), tool-calling. Floating widget, global on every page via `AppShell`. Low-risk actions (`add_contact`, `create_open_house`) execute immediately; anything sending to an external party (`send_email`) always previews and requires a separate confirm call that does **not** re-invoke Claude (token efficiency — the confirm step just executes the already-shown action). Daily per-agent cap (`DAILY_ACTION_CAP` in `lib/aiAdmin.ts`), checked *before* calling Claude so a request over the cap costs zero tokens.
3. **Pricing engine** (`app/api/meeting-valuation`) — a three-signal blend, all three logged per-run in `valuation_calibration_log`. **By explicit product decision, only two data sources are allowed to influence the price at all: the government registry, and top-producer feedback.** The agency's own `properties` listings (mostly still-active asking prices, not proven sales) and non-top-producer comments/estimates are excluded from both the live blend and NN training — see `top_producers_by_area`-filtering in both routes below.
   - **Comp-based** (`lib/valuation.ts`) — deterministic, not ML. Comp-weighted average over `market_transactions` only (time-decayed, IQR outlier-filtered) × floor/condition/age multipliers. No black box; every multiplier is a named, inspectable function.
   - **Small neural net** (`lib/miniNet.ts` + `lib/pricingFeatures.ts`) — a from-scratch, dependency-free MLP (2 hidden layers, ~35 input features: sqm, floor, age, renovated, condition, balcony, utilization_score, distance to metro/sea/Acropolis, competing active listings, one-hot neighborhood). Not an LLM, not a framework black box — every weight is plain JSON, forward/backprop is ~150 lines in one file. Trained via admin-triggered `app/api/pricing-model/train` (matches `valuation-backtest`'s "deliberate action, not background job" pattern) on `market_transactions` plus **top-producer-only** `meeting_comments.agent_estimate` rows, folded in as lower-weighted (0.3x) soft training examples — the literal mechanism for "reinforced by agent feedback," not RLHF (no policy/reward model, just supervised learning with weighted samples). Holdout accuracy (`pricing_model_runs.holdout_r2`/`holdout_mae_pct`) is logged every run and directly controls how much the blend trusts it (weight = `0.05 + max(0,r2)*0.35`, capped 0.30). **Known gap**: `top_producers_by_area` matches an agent via `properties.agent_email`, which is null on every closed comp today, so it always returns empty — meaning `feedback_folded_in` is currently 0 on every retrain, and the "reinforced by feedback" mechanism is dormant until that matching gap is fixed (agent_email backfill or switch the RPC to match by `agent_id`). Latest run (2026-07): 811 train / 143 holdout rows, all registry: R²≈0.17-0.32 (varies by seed), median error≈34-36% — real signal, not sophisticated yet.
   - **Top-producer feedback** — `meeting_comments.agent_estimate`, filtered to that area's top producers only (same known-empty-today caveat as above).

   **Meeting Ακινήτων is open engagement for everyone, training-eligible for few**: any agent can vote agree/disagree and comment on a valuation once it exists (`/api/meeting-comments`, no longer gated) — displayed as history (`% agree`, comment feed) in the Meeting Ακινήτων UI — but only top-producer-authored feedback is filtered back in server-side to actually move the price or the NN's weights. The workflow: open a `for_appraisal` property → a valuation already exists (auto-triggered on first admin open if missing, not manual-only) → agents review photos/maps/info and optionally comment → admin clicks "Ολοκλήρωση Εκτίμησης" to mark `completed` and jump to the next property in the queue.

   Also computes an honest probability-of-sale-within-6-months (empirical frequency table over closed comps, reports "insufficient data" below 8 comps rather than a fabricated percentage) and cites the top comparable by address/size/days-on-market in its reasoning text — never a fabricated name.

## Auth/permissions patterns

- `getAuthedAgent(req)` — resolves the caller's agent row from their bearer token. Every service-role route needs this.
- `isCeoOrAdmin(agent)` — role check.
- `canActAs(agent, target_agent_id)` — "can `agent` act on behalf of `target_agent_id`"; true for self, or admin/CEO **only within the same agency** (looks up the target's `agency_id` — don't skip this check, an early version trusted role alone and let a CEO in one agency act as any agent anywhere).
- Admin-gated actions in this codebase: triggering an AI valuation (sets "the price"), Meeting Ακινήτων comments (top-producers-of-the-area or admin only, and only once a valuation exists).

## Where things live

- Migrations: `supabase/migrations/`, numbered sequentially, applied via `npx supabase db push --include-all` (requires the linked project + interactive `y` confirmation). Push and **verify against live data** — don't assume a migration "worked" just because the CLI didn't error (see upsert/RLS gotchas above).
- Shared comp-based pricing logic: `lib/valuation.ts` (used by both the live route and the backtest, so they can't silently drift apart).
- NN pricing model: `lib/miniNet.ts` (the network), `lib/pricingFeatures.ts` (feature vector — single source of truth shared by training and inference), `lib/geo.ts` (haversine + POI/neighborhood-centroid reference data), `lib/geocode.ts` (best-effort Nominatim address geocoding, called server-side only — browsers can't set the User-Agent Nominatim's usage policy asks for).
- Contact name handling: `lib/contacts.ts`.
- AI Admin tool definitions: `lib/aiAdmin.ts` (`TOOLS` array + executors).
- Registry import: `lib/mamaRegistry.ts` + `app/api/market-data/import-registry`.

## Deployment

Vercel project `kwac-performance` (org `themis-projects1`), Supabase project ref `yihnycafoaemoambrdfd`. Work has been happening on branch `security-pricing-marketing-ai-admin` — not yet merged to `main`/production. Preview deploys via `npx vercel deploy`.
