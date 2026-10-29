# Handover: P3 Go live wiring (F3)

Brief: `brief/p3-golive-wiring` `docs/briefs/p3-golive-wiring.md`. Branch `claude/p3-golive-wiring`.
Class: BUILD-visual (user-facing save path). Builder: Opus. Review next: a different model (Fable), dispatched by the orchestrator.

## Data source (read live on prod 2026-10-29, read-only)

`public.complete_organiser_onboarding_v1(p_organiser_id uuid) RETURNS jsonb`, plpgsql, SECURITY DEFINER,
`search_path public, pg_catalog`. ACL `{postgres=X, authenticated=X}` (anon cannot call it).

| Server answer | When | Website shows |
|---|---|---|
| RAISE `authentication_required` | no `auth.uid()` | "You were signed out..." + **Sign in again** (returns to `/account/p3/start?o=..&at=review`) |
| RAISE `not_found` | not an `owner` entity member (manager, stranger, unknown id read the same) | "Only the page owner can put this page live..." + **Go to Home** |
| `{ok:false, reason:'incomplete', missing:[...]}` | `_onboarding_missing_v1` non-empty | "Not quite yet..." + the missing rows (each jumps to its step), Go live disabled with the reason; status re-read |
| `{ok:true, changed:false, lifecycle, review}` | already `live` / `pending_review` | straight to Live (or its review variant) |
| `{ok:false, reason:'invalid_state', lifecycle}` | lifecycle not draft/rejected (only `archived` per `organiser_profiles_lifecycle_chk`) | "This page can't go live from here..." + **Go to Home** |
| `{ok:true, changed:true, lifecycle:'pending_review', review:true}` | `_city_requires_review_p5(city)` (city has an ambassador) | "Sent for a quick check" (no confetti, Home only) |
| `{ok:true, changed:true, lifecycle:'live', review:false}` | otherwise | "You're live" + confetti, View / Share / Home |
| network / any other error | | "Couldn't go live... Everything you added is saved." + **Try again** |

Prod shapes: 49 organiser pages, all `live`; 0 of 319 cities have an ambassador (no review path today).

## Done

- `pageApi.ts`: `REAL_GO_LIVE` (`deployed: true`) calls the RPC through the existing untyped `rpc()` helper
  (the RPC is not in the generated types; `check:rpc-typing` passes). `GoLiveApi.complete` now RESOLVES
  `'live' | 'pending_review'` and REJECTS with `GoLiveError(refusal, missing)`. `OnboardingFlow` defaults to it.
- `pageModel.ts` (the one mapping): `goLiveState` gains `in-review` (pending_review) and `closed` (archived);
  `reviewCopy` covers them; new `goLiveOutcomeFrom`, `goLiveRefusalOfMessage`, `goLiveRefusalCopy`, `liveCopy`.
- Review: double-tap safe (ref guard; button busy "Going live..."; one call, one result); every refusal has one
  next action. Live: only after a real success; review variant never says "You're live".
- Live buttons: View / Share point at `/organisers/:id`, which exists only with `organiserDetail` on. With it off,
  View opens `P3_PATHS.youPage` and Share is hidden (it would share a "coming soon" page). Home = `/account/p3`.
- Tests: `__tests__/goLive.matrix.test.tsx` (60 cases: every server answer, Review lifecycle x missing x deployed
  30 cells, refusals, double tap, organiserDetail off). Red first: 34 of 60 failed against the unchanged source
  (stub, no outcome, no states). Existing fakes updated (`complete` returns `'live'`; mount defaults to the stub).
- Walk `tests/e2e/walk-p3-golive.spec.ts` (in `test:e2e` by name; skips with organiserP3 off like the slice walks):
  6 states x 390x844 / 320x568 x light / dark, 20/20 pass; screenshots in `docs/handovers/p3-golive-wiring/`.
  Every RPC is fulfilled by `page.route`; run it with a non-existent project host so nothing can reach prod:
  `VITE_SUPABASE_URL=https://walkfake.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=x VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_DETAIL=true npx playwright test tests/e2e/walk-p3-golive.spec.ts --project=chromium`
  (a `127.0.0.1` URL fails the dev CSP, `connect-src https://*.supabase.co`, and every read errors.)

## Deviation (needs owner eye)

- The prototype's review-variant title is "Sent for review". `src/modules/organiser/__tests__/consistency.matrix.test.tsx`
  (G3) forbids any string literal saying "for review" anywhere in the organiser module. The guard was kept; the
  title reads **"Sent for a quick check"**. If the owner wants the prototype words, the G3 guard's scope must change first.
- The brief says the "sent for review" copy already existed in `reviewCopy`; it did not (only `GO_LIVE_NOT_YET`).
  It is new here (`IN_REVIEW_SUB`, `liveCopy`).

## Fix later (not in this slice)

- `walk-p3-w4b2-page.spec.ts` fails `page-error` when the dev server is built with a non-supabase.co URL (CSP);
  its header command should name the env it needs, like this walk's.
- `organiserDetail` decides whether "View my page" can show the public page. Confirm its Vercel value before P3 goes on.
- invalid_state / not-owner offer Home only; a help (WhatsApp) link like audit L2 would give a person to ask.
- `complete_organiser_onboarding_v1` is not in the generated `types.ts` (types-drift should pick it up); then the
  call can move to the typed client.
- Audit L10 (DB flag `organiser_onboarding_gate`) still has no website explanation of the event-write refusal.

## Left / next

Nothing required in this slice. Next: review (Fable), then the owner phone test with both flags on.

## PR, checks, Verified / Not verified

PR #1144. The per-job table is in the PR body. Local results: typecheck, architecture-guard, lint chain, the organiser unit suite (7907),
phone suite (406 pass / 0 fail), build suite (73), perf-budget (bundle-budget output byte-identical to main) and the walk (20/20) all pass.
e2e-smoke had 182 pass and 2 R1 specs that failed under 4 workers and passed alone.

**Verified:** the live RPC body and ACL; prod lifecycle and ambassador counts; every server answer through REAL_GO_LIVE with a mocked client;
the Review x lifecycle x missing x deployed matrix; double tap; the browser walk at 390x844 and 320x568, light and dark.
**Not verified:** a real Go live (never called, by rule); the real review path (0 of 319 cities); real-device keyboard behaviour;
360x640 and 130% text for these states; the Vercel preview; the owner phone test.
