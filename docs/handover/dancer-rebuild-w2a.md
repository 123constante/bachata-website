# Dancer rebuild W2a: onboarding (`/app/welcome`)

Branch `arc/dancer-app-w2a`, from `claude/dancer-app-r1a` @ 9fc95715. No PR (the orchestrator merges the sub-branch).
Ticket dt_e4eac52c2241.

## What changed (all under `src/modules/dancer-app/screens/onboarding/` unless noted)
- `OnboardingScreen.tsx`: the stage machine. Starts from the server's `strength.missing` ONCE (adjust-state-in-render), then moves on from each save result. Root carries `data-testid="dancer-screen-welcome"` (the id W1's shell/reachability tests look for).
- `model.ts`: pure rules: stage order, resume rule (`stageFor`), next card (`stageAfterSave`/`stageAfterSkip`/`stageForBoost`), `ROLE_CHOICES` (Both = `Lead and Follow`), `EXPERIENCE_BANDS` + `startedYearForBand` (the ONE helper: 0 / 2 / 4 / 8 years back from the current year).
- `steps.tsx` (name, city, role, photo hand-off), `optional.tsx` (years, styles), `notes.tsx` (consent + linked notice, first card only), `ui.tsx` (meter, chips, buttons), `useLazy.ts`, `useMyDancerEdit.ts`.
- `__tests__/onboarding.test.tsx` (28 tests) and `__tests__/model.test.ts` (8).
- `tests/e2e/dancer-app/onboarding.spec.ts` (5 tests) and its name added to `package.json` `test:e2e` (the spec list; seam 4).
- `docs/handover/dancer-rebuild-w2a/*.png`: 390x844 screenshots (three shapes, every step).

## Decisions
1. Required cards are shown only while their `strength.missing` item exists; the tag is "n of m" over the cards THIS person needs.
2. After the four required cards: "You're in" at the server pct; Boost goes to the first optional card still missing; Skip/Continue chain to Nice work. A profile with all four fields and neither optional item missing (e.g. only `bio_social` left) is redirected to `/app/home`; so is a complete+extras profile.
3. Photo card has NO Continue and NO Skip: only "Take photo" / "Choose from my photos", both to `/app/me/photo?return=/app/welcome` (same URL; I invented no extra query param for W2d). On return, the page remounts and recomputes from the server.
4. Every save goes `saveMyDancerProfile(diffDelta(profile, stepKeys), profile)`: only changed keys; Skip sends nothing.
5. "You're in" and "Nice work" show the SERVER pct (no "90%" or "100%" text of mine except the brief's button label "Boost to 100%"). "Nice work" says "Your profile is at {server pct}%".
6. `profile_strength_70` fires once, when a save takes the server from <70 to >=70 (`{pct}` = the server value). `onboarding_step` fires per card via `trackDancerEvent`.
7. CityPicker is the real shared component, loaded with `lazyWithRetry` only when the city card shows (it adds ~27 KB gz and 8 chunks otherwise). The style list (`dancerConstants`) and the message-us link (`contactLinks`) are loaded on demand through `useLazy` for the same reason.
8. Inline "Message us" link gets a 44px tap box; the CityPicker trigger is forced to `min-h-[48px]`.

## INTERFACE deviations / for the orchestrator
- **Terms and Privacy links NOT rendered.** The brief asks for two links, but no Terms or Privacy page exists on the site (no route; `/privacy` is already in `navigateTargetsRoutable`'s known-unroutable list and `/terms` is not a route). Linking to a 404 is worse than text, and the guard refuses new unroutable targets. The consent line is plain text ("By continuing you accept the Terms and Privacy policy."), with `// TODO(1b): accept_terms_v1` in `notes.tsx`. needs owner: the legal pages (or confirm the text-only line).
- **`perf-budgets.json`: raise the `dancer-app` chunk allowance 41 -> 42** (`attribution.chunkAllowance`-style row at line ~110). Measured on this branch: 303.6 KB gz first-load (budget 310, ok), 3 pullers (allowance 3, ok), 42 chunks. The +1 chunk is `assets/analytics-*.js` (`src/lib/analytics.ts` is now shared between the dancer-app chunk and a lazy chunk, so rollup splits it out). Base W1 tip measured 296.8 KB / 41. I did NOT edit the shared file; until it is raised `check:bundle-budget` (hence `pre-ship`) is red on exactly that line. Every other row is ok.
- `useMyDancerEdit` was not exported by W1: written in `screens/onboarding/useMyDancerEdit.ts`, same key `['my-dancer-edit', userId]`, `refetchOnMount: 'always'`. Duplicate to delete when W1's lands (ORCHESTRATOR comment in the file).
- `tests/client/dancerAppShell.test.tsx` and `tests/e2e/dancer-app/reachability.spec.ts` (W1) look for `dancer-screen-<id>` on every route; the onboarding root keeps `dancer-screen-welcome`, so neither needed an edit.
- Round-2 additions (new error copy; WhatsApp key drop) are the W1-finish worker's. My screen never sends `whatsapp` or `show_whatsapp_publicly`, and shows errors only through `DancerApiError.message` (so new codes appear with no change here).
- `scripts/check-dancer-area-isolation.mjs` reports 1 violation that is not mine: `docs/session-handover-2026-10-15-dancer-w1.md` (a W1 file outside the allowed list). Everything I changed is inside `src/modules/dancer-app/`, `tests/`, `docs/handover/`, and the `package.json` test:e2e seam.

## Shapes surveyed
No prod query this run (read-only SELECT was not needed: the shapes are W1's `DANCER_SHAPES`, the plan's section-3 survey of 152 live profiles / 15 with a role / 97 with a photo / 91 with a city). Screen x shape coverage:

| shape | first card | notes |
|---|---|---|
| emptyStub | name (1 of 4) | consent line, no linked notice |
| nameCityOnly | role (1 of 2) | |
| adminUnclaimedPhotoless | photo | no Continue/Skip |
| claimedIncompleteAdmin | role | linked notice shown |
| fourFieldComplete | You're in (70%) | Boost, years, styles, Nice work |
| adminSurnameInDisplayName | You're in | |
| completeAllExtras | redirect `/app/home` | no onboarding |

## Red-first proof (mutants run against the new tests)
- Mutant A: city step sends `first_name` and the diff is bypassed (`save(delta, profile)`): `the whole walk: exact keys per step...` FAILED (`- Expected + Received`, the saved list gained `first_name`); 1 failed / 35 passed. Reverted.
- Mutant B: meter shows 70 once the four fields exist instead of the server value: `the whole walk...` and `the You are in card shows the server pct (73), not a client 70` FAILED; 2 failed. Reverted.

## CI per-job table (sandbox, Node 22; GitHub billing blocks real runs)
| job / step | command | result |
|---|---|---|
| unit (W2a files) | `npx vitest run src/modules/dancer-app tests/client` | 353 pass, 1 fail: `dancerAppApi fetchGate` (fails identically on the base W1 tip, not mine) |
| unit (whole repo) | `npx vitest run` | 7608 pass, 19 fail before my last fixes: all pre-existing/sandbox (live-DB contract tests, `integrityCouldNotRun`, `reminderBanner.today /app` x2, `dancerAppApi fetchGate`); the only one mine (`dancerAppShell /app/welcome`) is fixed |
| typecheck | `tsc --noEmit -p tsconfig.app.json` | 0 errors under `dancer-app/`; repo ratchet 96 < baseline 106 |
| lint chain | `npm run lint` | 15/16 PASS; `check:integrity` exit 126 = file not executable in this sandbox, `bash bin/check-integrity.sh` = ok, 0 issues |
| eslint (my files) | `npx eslint screens/onboarding tests/e2e/dancer-app` | 0 errors (2 react-refresh warnings in ui.tsx) |
| pre-ship eslint scoped | | fails on files NOT mine (`shell/renderInShell.tsx`, 2 regression tests) |
| build | `npm run build` / `build:ship` | ok |
| bundle budget | `npm run check:bundle-budget` | dancer-app 303.6 KB ok, pullers ok, **chunk ratchet 42 vs 41 OVER** (see deviations) |
| first-load requests | `npm run check:first-load-requests` | ok (6 routes) |
| isolation | `node scripts/check-dancer-area-isolation.mjs` | 1 violation, W1's handover doc, not mine |
| e2e | `npx playwright test tests/e2e/dancer-app --project=chromium` (with the CI placeholder env) | 19 passed (14 W1 + 5 mine) |

## 390x844 walk
Done in headless Chromium against the dev server with `page.route` mocks (gate, `my_dancer_edit_v1`, `save_my_dancer_profile_v2`, `search_cities`); every shot asserts no control under 44px high and no horizontal scroll. Shots: `stub-1-name`, `stub-2-city`, `namecity-3-role`, `namecity-4-photo`, `complete-5-in`, `complete-6-years`, `complete-7-styles`, `complete-8-nice` (three shapes).

## Verified / Not verified
Verified: the table-driven unit tests; the two mutants going red; the 5-test Playwright walk; build; the budget numbers above.
Not verified: a real phone; real prod data in a browser (mocked RPCs); the real photo hand-off round trip (W2d's screen is a placeholder here, so "photo saved then back" is simulated by saving the avatar and reopening); 200% text zoom and 360x640 only by style assertions (long names wrap via `overflow-wrap:anywhere`), not by screenshot; the real `CityPicker` list of 319 cities (mocked `search_cities` returns London only); `accept_terms_v1` (not in 1a); the legal pages (do not exist).

## What is left
Raise the chunk allowance (orchestrator); decide on Terms/Privacy pages; delete the duplicate `useMyDancerEdit` when W1's lands.
