# Handover: B1b S2, public dancer page v2 (`claude/dancer-app-r1b-public`)

Ticket `dt_09de19a120fa`. Brief `briefs/dancer-rebuild-b1b-s2-public.md` (arc/briefs-dancer-rebuild @165991b5).
Base `origin/main` c36fbafd. No PR (per the B1b COMMON: the orchestrator merges the slices).

## What changed (files)

New, all under `src/modules/dancer-app/public-page/`:
- `model.ts`: everything the page shows, as data (`buildPublicDancerPage`), plus `whatsappHref`,
  `experienceLevel`, `instagramLabel`, `facebookLabel`, `joinHref`, `shareDancerPage` (Web Share, then
  copy, then "copy by hand"), `SHARE_MESSAGES`.
- `loadPublicPage.ts`: `loadPublicPageV2(profileId)` -> `{ page, degraded }`, the route loader's one call.
  `dancer_area_gate_v1` (anon may call it; signed out it answers the global flag) and `get_public_dancer_extras_v1`
  side by side through the existing `api/gateRpc.fetchGateRaw` / `api/rpc.fetchPublicExtras` (imported, `api/` untouched),
  each with a 2.5 s deadline. Flag closed => `page: null` (today's page). Flag read failed / timed out => `page: null`,
  `degraded`. Extras failed => v2 without bio / languages / WhatsApp, `extrasOk: false`, `degraded`.
  A degraded answer is edge-cached for at most 60 s (`taggedData` `edgeTtlBoundSeconds`), not the normal 1 h.
- `PublicDancerPageV2.tsx`: the portrait-first page (dancer theme tokens from `theme/dancer.css`).
- `__tests__/shapes.ts`, `model.test.ts` (26), `route.test.ts` (21), `page.test.tsx` (40).

Changed (both named in the brief):
- `app/routes/dancers.tsx`: starts `loadPublicPageV2` beside today's profile read (it never rejects), adds
  `publicPage` to the loader data, passes it to `<DancerProfile publicPage=...>`. `entityName`, `entitySlug`,
  `ogImage`, the cache tag, `meta()` and `headers()` are computed exactly as before.
- `src/pages/DancerProfile.tsx`: optional prop `publicPage` (default null = today). The "Your plans" block
  moved into a local `ownerPlans` const (same JSX) so v2 can show it to the owner; loading and not-found
  states are shared by both modes. Today's render is unchanged (the R0 snapshot suite passes untouched).
- `src/modules/profile/dancerPublicProfile.ts`: NOT changed (not needed).

Also `src/modules/dancer-app/__tests__/journeyGuards.test.tsx` (IMG_ALLOWED += the public page, see Decisions).

Docs: this file; `docs/review-pack/r1b-public/` (11 PNGs, each < 50 KB, + `captions.md`).

## Section inventory: old -> new (nothing lost)

| Today (`DancerProfile.tsx` / `DancerProfileGrid.tsx`) | v2 |
|---|---|
| Site chrome (GlobalLayout, back to /dancers, no subheader) | same |
| Loading skeleton | same (shared) |
| Not found (unknown, paused, hidden, archived, deactivated) | same page (shared; loader 404 unchanged) |
| Hero title: name / "Dancer", subtitle city . nationality | portrait header: name (h1), city . nationality |
| Identity tile: photo or initial, nationality flag | full-width portrait, or PersonAvatar (no-photo face) on the dancer gradient; flag kept |
| Role + "N years dancing" tile | role . N years dancing line on the portrait |
| Experience tile (years, months, Veteran/Experienced/Intermediate/Rising/Newcomer) | Experience section (years + same five levels). Months: today's `dancingStartDate` is always null, so it never showed |
| Connect tile (Instagram, Facebook, website, email icons; "No public contacts") | Connect list with labels; empty state "No public contacts yet. Use Share to send this page to a friend." |
| Instagram card (@handle) / Facebook card (facebook.com/name) | labels inside Connect (same derivation) |
| Practice Buddy (status, looking for, levels, goals max 4 + "N more", details) | Practice buddy section, all levels and all goals |
| My Sound (songs) | My sound |
| Styles (first 5) | Styles (all) |
| Highlights (first 2) | Highlights (all) |
| Event appearances (`ProfileEventTimeline`) | same component, same props |
| Gallery (max 12, opens full image) | same, max 12 |
| "Your plans" (owner only, events + festivals) | same block, owner only |
| (new) | Share, WhatsApp (only when the RPC returned it), Join (signed-out only), About (bio), Speaks (languages) |

## Decisions and INTERFACE deviations

- Mode read in the LOADER (server HTML = first paint). `open` only; `allowed` is ignored (brief: "only when the open flag is true").
- Gate + extras in parallel, and both beside today's profile read, so v2 adds no serial round trip. When closed the extras
  answer is dropped (one wasted anon read per origin render while closed; the flag is open on prod).
- The v2 component is imported statically (not lazy): the flag is open on prod, so every visitor renders it; a lazy chunk would
  add a request to every dancer page. Revisit if the flag is closed for long.
- Breadcrumbs: v2 keeps today's `showSubheader={false}` with no breadcrumbs (today's page does the same; changing the
  site chrome is out of scope). Flagged for the orchestrator against `.claude/rules/breadcrumbs.md`.
- WhatsApp link: the save RPC accepts local numbers (`^\+?[0-9][0-9 ()-]{5,24}$`), so with no "+" a leading "00" is dropped and a
  single leading "0" is read as UK (0 -> 44). Fewer than 7 digits = no button.
- Theme: the page sets the dancer CSS variables inline from `theme/tokens.ts` (`DANCER_TOKENS`, the object `dancer.css` is
  pinned to) instead of importing `dancer.css`, which must keep exactly one importer (the shell).
- Photoless portrait: the site's one avatar (`PersonAvatar`, no-photo face) centred on the dancer gradient, not an own initials
  disc. The full-width portrait and gallery `<img>` are not avatar discs: `PublicDancerPageV2.tsx` joins `IMG_ALLOWED` in
  `src/modules/dancer-app/__tests__/journeyGuards.test.tsx` (a module test, edited with that reason).
- Join uses the site's `buildSignInHref(pathname, 'signup')` (sanitised `returnTo`), not a hand-built URL.
- Paused / hidden / archived need no new rule: anon RLS on `dancer_profiles` uses the same predicate as the extras RPC
  (`is_active IS NOT FALSE AND archived_at IS NULL AND _person_publicly_visible_v1(person_id)`), so the loader 404s first in both modes.
- Join = `/auth?returnTo=/dancers/<slug>` (Auth.tsx already honours `returnTo`). Hidden until auth settles (no flash for a signed-in
  dancer; on the server it is never rendered). Anonymous session counts as signed out.
- Views: the page never called `emitProfileView` / `record_profile_view_v1` (it is called by the CARDS that link here); v2 adds no recorder.
  Tested: no `*view*` RPC from the loader or the page.
- Practice status copy "Down to Practice!" (with an emoji) -> "Up for practice" (plain words rule).
- Experience levels are a second copy of `DancerProfileGrid`'s five bands (that file is outside my allowed list). Only one of the two
  pages ever renders, so no screen shows both; a later clean-up can make the grid import `experienceLevel`.
- Cache: the HTML is edge-cached under the dancer's tag. A flag flip needs the purge the plan already assigns to
  `admin_dancer_area_set_open_v1` (PLAN risk 2 / check 9); not in this slice.

## NEEDS ORCHESTRATOR: isolation check

`npm run check:dancer-area-isolation` fails on this branch: `src/pages/DancerProfile.tsx` and `app/routes/dancers.tsx` are in the
`protected` list of `scripts/dancer-area-isolation-allowlist.json`, and both now import from `src/modules/dancer-app/`. The brief
allows exactly these files; the allow-list may not be edited by a worker. Needed: move both paths from `protected` to `seams`
(seamNotes: "B1b S2 public page v2: flag read in the loader, v2 render").

## Shapes surveyed (prod `stsdtacfauprzrdebmzg`, read-only, counts only, 2026-10-17)

dancer_profiles 172 = 157 live + 15 archived; live but not publicly visible 0; photoless 53; with display_name 85;
unclaimed (claimed_by null) 152; nameless 2; hide_surname_publicly 0; bio 0; languages 12 (max 2); public WhatsApp 0;
gallery 1. `app_feature_flags.dancer_area_open` = true. `dancer_area_gate_v1` and `get_public_dancer_extras_v1`: EXECUTE for anon = true.
`app_feature_flags` SELECT policy is authenticated-only (so the flag is read through the gate RPC, never the table).
anon SELECT policy on dancer_profiles = the visibility predicate above.

## Review (`/code-review` high, before commit): 10 candidates

Fixed: (1) no deadline on the new reads -> 2.5 s deadline, a hang falls back to today's page (test); (2) a failed read was cached
for the full edge TTL -> 60 s bound when degraded (test); (3) `gallery_urls` NULL element crashed v2 -> strings only (test, red-first);
(4) extras failure showed "No public contacts" (false if a WhatsApp exists) -> `extrasOk`, no claim (test); (5) UK local WhatsApp
numbers -> 0 -> 44 (test); (6) extra serial round trip -> started beside the profile read; (8) Join re-implemented
`buildSignInHref` -> reused; (10) raw U+00B7 on a moved line -> `\u00b7`. Not changed, with reason: (2b) flag-flip purge is the
admin side's job (PLAN risk 2); (7) lazy v2 chunk (see Decisions); (9) breadcrumbs (see Decisions).

## Red-first proof

The new tests run against main's `DancerProfile.tsx` + `app/routes/dancers.tsx` (module files present): **36 failed / 22 passed**, e.g.
`AssertionError: expected null not to be null` (no `dancer-page-v2` with the flag open) and
`AssertionError: closed: expected undefined to be null` (loader returns no mode). With the change: all pass.
Review bug (3): with `clean()` reverted, `model.test.ts` "gallery: NULL elements" fails with
`TypeError: Cannot read properties of null (reading 'trim')`; restored: 26/26 pass.
Bug found on the 390x844 walk: at 200% zoom a long name overflowed the top of the portrait (name block was absolutely positioned);
fixed by putting the name block in flow (header grows). Screenshot 07.

## CI per-job table

Run in the sandbox on this branch. GitHub Actions did not run (no PR, by the brief).

| workflow | job | command | exit | result |
|---|---|---|---|---|
| architecture-guard | integrity | `bash bin/check-integrity.sh` | 0 | 1780 files, 0 issues |
| architecture-guard | integrity | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 | pass |
| architecture-guard | integrity | `AUDIT_STRICT=1 npm run check:images` | 0 | 0 missing alt/loading |
| architecture-guard | integrity | `check:image-widths` (+ self-test) | 1 -> 0 | first run: `PublicDancerPageV2.tsx:114 optimizedImageUrl(..., 720)` not an allowed size; fixed with `srcWidthFor(576)`; re-run ok (54 calls) |
| architecture-guard | integrity | plan-hygiene, workflow-artifact-policy, mojibake (self-test + grep), prove:entry-point (+ self-test) | 0 | pass (45 entry points) |
| typecheck | wallclock-brand | `check:rpc-typing`, `check:wallclock-brand` | 0 | pass |
| (pre-ship) | - | `npm run typecheck` | 2 | 97 errors (baseline 106), 0 in changed files |
| (pre-ship) | - | eslint on changed files | 1 | 4 `no-explicit-any` errors in `DancerProfile.tsx`, all pre-existing (main has the same 4); 0 in `public-page/` |
| workflow-lint | bom / masking / notification / preview-prefixes | as in the workflow | 0 | pass |
| unit-tests | unit (London) | `TZ=Europe/London npm run test:unit` | 1 | first run 18 failed / 9209 passed. Mine (fixed, then re-run green): `journeyGuards` hand-drawn `<img>` in PublicDancerPageV2, `dancerAppTheme` "exactly one importer" of dancer.css, `imageWidths`. Not mine (sandbox): 10 event-RPC contract tests "Invalid API key" (the sandbox Supabase is not prod), 5 `integrityCouldNotRun` (global NODE_PATH makes typescript resolvable) |
| unit-tests | unit (London), after fixes | `vitest run src/modules/dancer-app tests/client/dancerAppTheme.test.ts tests/imageWidths.test.ts tests/regression/today/dancer*` | 0 | 28 files, 662 tests |
| unit-tests | timing / New_York / Sydney | as in the workflow | 0 | 65 / 213 / 213 passed |
| unit-tests | dancer-area-isolation | self-test / check | 0 / 1 | check fails, EXPECTED (see NEEDS ORCHESTRATOR): `(a) PROTECTED file changed` x2, `(c) ... imports from the dancer-app module and is not a seam file` x3 |
| e2e-smoke | e2e-smoke | `npm run test:e2e` | 0 | 147 passed, 1 flaky (`dancer-home.spec.ts:168`, not this page), 1 skipped |
| phone-qa | phone-qa / build-smoke | phone config; build + build config | 0 | 272 passed / 66 passed |
| perf-budget | bundle-budget | build + bundle-budget + first-load-requests + chunk-cycles (+ self-tests) | 0 | budgets respected, request pins match, no cycle |
| db-contract-check | contract-check | migration stamps, guest-list self-test, day-rollover, script conventions | 0 | pass |
| db-contract-check | contract-check | the live-DB contract steps | - | cannot run: no prod secret in the sandbox (they read the live DB, not this code) |
| phone-qa-section / real-data-verified / bot-pr | - | - | - | cannot run: need a PR body / GitHub API (no PR by the brief) |
| (other) | - | `tests/regression/today/account.today.test.tsx` | 1 | 1 failure, identical on a clean `origin/main` worktree: not this branch |
| build | - | `npm run build` | 0 | built |

Note: the e2e / phone runs rewrite committed PNGs under `docs/handover/` and `docs/review-packs/`; those were restored, not committed.

## 390x844 walk

Done on the production build (`npm run build` + `scripts/_serve-build.mjs`, SSR), Chromium, 390x844, isMobile, invented rows in the
surveyed shapes served by a scratch fetch preload (not committed). Flag open and closed servers side by side. Results: v2 in the
SERVER HTML only when open; `<head>` byte-identical between open and closed apart from the request origin inside og:image; nameless
=> `noindex,nofollow` in both; paused => 404 in both; no horizontal scroll on any page, 0 page errors, Share 44px tall (88 at 200%).

## Verified

- Closed / failed flag = today's page: the R0 snapshot suites (`tests/regression/today/dancerPage.today` 50, `dancerRoute.today` 17) pass unchanged.
- Head identical in every flag mode (closed / open / gate error / odd shape) for 7 shapes (route.test) and in real SSR HTML (walk).
- Shape x viewer matrix (6 shapes x signed out / signed-in stranger / owner, flag open and closed), extras on/off, many languages,
  WhatsApp on/off/junk, Share (sheet / copy / manual), Join href + no flash, no view recorder, hidden surname.
- `npm run build` exit 0.

## NOT verified

- No real phone. No sign-in in the browser walk: the signed-in and owner ("Your plans") views are covered by jsdom tests only.
- Not walked on REAL prod rows (by choice: screenshots go into a public repo); shapes are prod-shaped invented rows.
- A real WhatsApp number from the RPC: 0 such rows on prod today.
- The flag-flip cache purge (admin side, not this slice).
- Real Web Share sheet on iOS / Android (Chromium headless has none; the copy fallback was walked).

## What is left

1. Orchestrator: allow-list decision above, then the isolation job goes green.
2. Optional clean-up: `DancerProfileGrid` imports `experienceLevel` from the model (needs that file in scope).
