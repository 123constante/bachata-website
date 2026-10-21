# Arc 1, PR 3 slice A: dancer 4 + city (branch `claude/arc1-pr3-dancer4`)

Brief: admin `docs/briefs/arc1/arc1-pr3-onboarding.md` (sha c3b77f4), common + as-built read first.

## Done
- `src/modules/organiser/home/onboarding/dancer4/`
  - `dancer4Model.ts` (pure): `planDancer4(missing, prefill)` (which screens, prefill skips answered questions, never overwrites an existing name/city), `STEP_COPY` (one words mapping), `disabledReason` (every disabled Next states why), `buildDancer4Save` (only changed values; untouched sends no command), `normaliseCityRequest`, `pickChipCities`, `parsePrefill`.
  - `Dancer4Flow.tsx`: one question per screen (first name, city, lead or follow, photo), progress, Back, each Next saves, last Next asks the server (`profile_complete_v1` through completion refetch) before leaving. City: chips + search (`search_cities` through the existing `searchCities`) + "Can't find it? Tell us your city" (request, then the person must still pick the nearest city; the screen says so).
  - `prefillStore.ts`: `rememberDancerPrefill(data.prefill)` / `readDancerPrefill()` / `clearDancerPrefill()` (sessionStorage + memory).
  - `dancer4Api.ts`: chip read of `cities`, `city_requests` insert.
- `src/pages/FinishProfile.tsx`: when GATED (the dancer-first gate, which also wraps `/invite`) and the person has a profile id, renders `Dancer4Flow` instead of the all-fields form. The un-gated Finish screen (rating card, banner) is unchanged and keeps its Skip.
- Tests: `dancer4/__tests__/*` (45 incl. table over missing x prefill; mutation-proven red), `FinishProfile.test.tsx` (2 gated tests rewritten, 1 added), `DancerFirstGate.matrix.test.tsx` (finishTheForm walks the screens; the Finish-screen cell now asserts "Step 1 of N" and the asked fields in order), `tests/regression/today/account.today.test.tsx.snap` (6 gated-incomplete cells updated: the intended change only).

## Left / for the owner of the invite page (NOT done here, on purpose)
- **Wire the prefill.** Prefill only reaches the client on a BOUND link redeemed in a proven-mailbox session. `InviteRedeemPage` today wraps `DancerProfileGate` around the redeem and redeems only after the Join press. For prefill to reach these screens, that page must (bound link + signed in) call `redeemOrganiserInvite` BEFORE the gate renders and call `rememberDancerPrefill(data.prefill)`. This slice only built the consumer; it did not touch `InviteRedeemPage`/`inviteModel` (other slices own them). Until wired, `readDancerPrefill()` is empty and all four questions show.
- Real-phone check of the new screens (keyboard, upload), a 390x844 browser walk with an authenticated prod-shaped session.

## Facts found (read-only)
- `VITE_ENABLE_CITY_REQUESTS`: only the old pickers read it (`=== 'true'`; `.env.example` blank). The Vercel API is blocked from this sandbox (proxy 403), so its PROD VALUE IS UNKNOWN: needs owner: Vercel token / dashboard. This flow does NOT depend on it (owner decision 11 makes the request part of the flow).
- `city_requests`: 0 rows on prod; RLS on; policies: insert own (`requested_by = auth.uid()`), admin select/update. Columns: requested_name, requested_slug, requested_by, status (pending|approved|rejected), notes, context, ... Our insert sets `context='dancer4_onboarding'`.
- `cities`: 319 rows, only 1 active (London) and `population` is set on only 1 city, so chips are by NAME (London, Madrid, Barcelona, Manchester, Birmingham, Paris, Berlin, Lisbon), ambiguous names dropped; the dancer base is London 81, Madrid 23, Cordoba 2, others 1. Search finds the rest. A proposal; the owner can change `CHIP_CITY_NAMES`.
- Prototype v8 wording reused unchanged for titles, the city-request note and the disabled reasons.

## Verified / Not verified
Verified: vitest on all touched areas (281 tests green), eslint on touched files (0 errors), tsc clean for touched files, `npm run build` ok, `bin/check-integrity.sh` ok, lint chain 19 of 20 links green (the 20th, `check:integrity`, only failed because `bin/check-integrity.sh` is not executable in this sandbox; run through bash it is ok).
Unit run: 22 failures, all outside this slice and identical on `main` in this sandbox (contract tests need live Supabase; `integrityCouldNotRun` env); one was ours and is fixed (raw U+2026 in source, now `…`).
Not verified: real phone / keyboard / photo upload, authenticated browser walk at 390x844, Vercel preview, GitHub checks, real invite (prod has 0 bound invites), the prod value of VITE_ENABLE_CITY_REQUESTS.

## Fix pass (PR #927)
- (5) Chips: read-only prod check of `profile_complete_v1`: it needs `based_city_id IS NOT NULL` only (no active check); FK `dancer_profiles_based_city_id_fkey -> cities(id)`, no city triggers. So an inactive city satisfies the gate and NO filter is added (1 of 319 active would empty the chips). Table test added: chips do not depend on the active flag.
- (6) `city_requests` has no CHECK on `context` (only status + audit checks); no DB function reads `context` (only approve/reject_city_request). Insert now uses `context: 'general'` (the shared picker default) and puts `dancer4_onboarding` in `notes`. NOT verified: the admin daily digest (it is not in the DB functions; its code lives in the admin repo/edge function, unreadable here), so whether it groups by `context` is unknown; 'general' is the safe known value.
- Prefill wiring untouched. vitest dancer4 49 green, `npm run build` ok.
