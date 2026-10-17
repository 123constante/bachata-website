# B1b S3 handover: app screens (branch claude/dancer-app-r1b-app, ticket dt_b601932e4702)

Base: origin/main c36fbaf. No PR (the orchestrator merges the three slices). ONE push.

## What changed
- `api/`: types (`MyDancerStats`, `MyProfileViews`, feedback + feature types), 4 new error codes (`invalid_body`, `invalid_kind`, `invalid_page`, `invalid_feature`), 5 wrappers in `rpc.ts` with parsers (counts are whole numbers >= 0, never NaN), backend slot in `gateRpc.ts`, fake backend (stats/views, feedback with a 5-a-day limit, feature interest), `statsFixtures.ts` (zero, one, normal, huge, error), `numbersModel.ts` (THE one mapping for Home and My page), `useMyNumbers`, `useFeatureInterest`.
- Home: `NumbersTiles` (weekly views tile + 4-cell strip, loading / error / zero states) and `PartnerTile`.
- `/app/page` (`screens/page/`): says how the page looks, View my page + Share, disabled WITH a reason when paused or not complete. Route added to `shell/routes.ts`, `DancerAppRoutes`, `catchallClientPaths.ts`. Reached from Me ("My page") and Options.
- Options: the feedback row is an in-app sheet (`FeedbackSheet`, `feedbackModel`): kind chips, text box (max 2000, the RPC limit), `submit_feedback_v1` with `p_page` = current route; `rate_limited`, `area_closed`, offline each have their own copy. `feedback_sent` fires once on success (`{channel: 'in_app'}`). The WhatsApp "Help and message us" row is kept.
- `perf-budgets.json`: dancer-app 363 -> 368 KB (measured 366.7 KB, +4.4 KB; justification in the file).
- Tests: `__tests__/b1bAppScreens.test.tsx` (41 cases); `/app/page` added to the journey-consistency screen table; three older tests updated for the new truth (homeAudit M19 "no coming-soon tile" -> exactly one, with a working button; Options feedback is a button; route table + error code lists).

## Decisions and INTERFACE deviations
- Stats strip shows Going / Interested / Nights been to / Levels rated from `my_dancer_stats_v1`; the weekly tile uses `my_profile_views_v1.last_7_days`. `numbersFrom` takes `max(views.total, stats.views_total)` for the all-time number so the two RPCs can never disagree on a screen.
- "View my page" opens `shareUrlFor(profile_id)` (`/dancers/<id>`, which redirects to the slug form): `MyDancerEdit` has no slug and S2 owns the public page. Not S2's component.
- "Not public yet" = profile not `complete` (name, city, role, photo) or paused. Mirrors Options' existing Share rule plus completeness.
- `public/robots.txt` already has `Disallow: /app/`, which covers `/app/page`; no edit needed.
- `package.json` e2e spec list: no new spec added, unchanged.
- Hit the journey checker for real: my first strip empty text said "Tap Going on a night", pointing at a control not on Home. 24 journey cells went RED; reworded to "Your counts start when you say you are going to a night." (red-first proof: `journeyConsistency.test.tsx > home` 24 failures before the rewording).
- Edited tests outside the module: `tests/client/dancerAppApi.test.tsx`, `tests/client/dancerAppShell.test.tsx` (code and route lists). Isolation check passes.

## Consent finding (brief item 5)
The /app screens write NO consent: terms are recorded at sign-up (`Auth.tsx` `acceptTerms`, `AuthCallback.tsx` for e-mailed links) and by the one-tap card at sign-in when none is on file. So "first app visit writes one" is not how it works and I did not change it. Proven by test: visiting Home and Options makes zero `accept_terms_v1` calls; `acceptTerms()` twice sends the same (`terms_privacy`, `TERMS_VERSION`) both times and a server modelling `accept_terms_v1` stores one row and answers `already_accepted` the second time. Existing `AuthConsentFunnel.test.tsx` covers the sign-in card. No gap proven, nothing fixed.

## Shapes surveyed (prod stsdtacfauprzrdebmzg, read-only, SOURCE only, no row counts run)
Read `pg_proc` for `submit_feedback_v1`, `my_dancer_stats_v1`, `my_profile_views_v1`, `register_feature_interest_v1`, `my_feature_interest_v1`, `accept_terms_v1`. Shapes relied on:
- `my_dancer_stats_v1()` jsonb: `profile_id, member_since, today, nights_going_upcoming, nights_went, interested_upcoming, level_votes, views_30_days, views_total` (ints; errors `area_closed`, `not_signed_in`, `no_profile`).
- `my_profile_views_v1()` jsonb: `profile_id, total, last_7_days, last_30_days, previous_30_days, last_viewed_at, by_type{dancer,teacher,dj}` (counts are 0 and `last_viewed_at` null with no rows).
- `submit_feedback_v1(p_body, p_kind, p_page)` -> `{id, kind, created_at}`; body 1..2000, kinds `general|bug|idea|praise`, page <= 200; 5 a day then `rate_limited`; errors `invalid_body|invalid_kind|invalid_page`.
- `register_feature_interest_v1(p_feature)` -> `{feature, registered_at, already_registered}`; features `partner_search|classes|badges|year_in_review`; `my_feature_interest_v1()` -> `{available[], features:[{feature, registered_at}]}`.
- Client profile shapes: the 19 named fixtures in `api/fixtures.ts` (the 2026-10-15 survey: with/without photo, hidden surname, paused, nameless, admin-made, no persona). Stats shapes: zero, one, normal, huge (millions), error.
- NOT re-counted on prod today (no row-count SELECT run): the reviewer should check the live counts of `feedback_messages` / `feature_interest` are small before the area opens to everyone.

## CI per-job (sandbox; no GitHub run)
| job / step | command | exit | result |
|---|---|---|---|
| unit tests | `npm run test:unit` | 1 | 9181 pass, 17 fail: 15 are PRE-EXISTING (verified identical on a clean main: eventViewCompat, integrityCouldNotRun, occurrenceProgram, publicEventPageLineup); my 2 were fixed after (non-ASCII in my test file, a Message-us exit on /app/page) |
| dancer-app + tests/client re-run | `npx vitest run src/modules/dancer-app tests/client` | 0 | 1266 pass, 10 skipped |
| dancer isolation | `node scripts/check-dancer-area-isolation.mjs` | 0 | OK |
| lint chain | `npm run lint` | 1 | every link PASS except `check:integrity`, which fails with exit 126 (script not executable in this sandbox); `bash bin/check-integrity.sh` -> ok, 0 issues. eslint link SKIPPED by the chain; `npx eslint src/modules/dancer-app --quiet` shows one error in `EditScreen.tsx:95` (react-hooks/refs), present on main, not mine |
| typecheck | `tsc -p tsconfig.app.json --noEmit` | - | 97 errors both on clean main and here (missing generated route types in the sandbox), none in files I touched |
| rpc typing | `npm run check:rpc-typing` | 0 | pass |
| build | `npm run build` (twice, second with the perf-budget placeholder env) | 0 | built |
| bundle budget | `npm run check:bundle-budget` | 0 after raising | dancer-app 366.7 KB vs 363: raised to 368 (see perf-budgets.json) |

## 390x844 walk: NOT DONE
No signed-in browser session against prod-shaped data in this sandbox, so `docs/review-pack/r1b-app/` has no screenshots. Walk script for the orchestrator (build + `npm run preview`, sign in as a beta dancer on a phone-size viewport, repeat on a zero-activity account and a hidden-profile account):
1. `/app/home`: weekly tile reads a number (or "Add a photo and share your page." on zero), 4-cell strip fits with no clipping at 390 wide, partner tile -> "Tell me when it's ready" -> "We'll tell you" and stays disabled after a reload.
2. `/app/page`: View my page opens the public page; on a hidden profile both buttons are off with the reason visible.
3. `/app/options`: "Send feedback" opens the sheet; keyboard does not cover Send; send one message -> thanks; a sixth in a day -> "You've sent a few today, try again tomorrow."; "Help and message us" still opens WhatsApp.

## Verified / Not verified
Verified: unit behaviour of every new screen against the in-memory backend over all stats shapes and all 19 profile shapes (My page); one shared mapping (Home and My page read identical numbers); disabled controls carry reasons; parsers never produce NaN; production build; budgets; isolation.
Not verified: any real phone / 390x844 browser walk; real RPC calls against a live database (prod is read-only, E2E not used); `feedback_sent` reaching the real analytics dataLayer in a deployed build; live GitHub CI (payments annotation may apply); the `/code-review` pass the repo requires before commit (the owner types it).

## What is left
- Screenshots + `captions.md` in `docs/review-pack/r1b-app/` (walk above).
- Owner `/code-review` round; raise nothing else.
