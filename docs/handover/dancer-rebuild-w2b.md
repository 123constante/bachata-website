# Dancer rebuild W2b: Home (`/app/home`) + Nights (`/app/nights`)

Branch `arc/dancer-app-w2b`, from `claude/dancer-app-r1a` at `9fc95715`. No PR (the orchestrator merges the sub-branch).

## What changed (files)
- `src/modules/dancer-app/screens/nights/`: `nightsModel.ts` (THE one attendance mapper + date/label helpers + 7-day nudge rule),
  `useMyNights.ts` (thin wrapper over the existing `get_my_event_attendance_v2` via `rpcLoose`), `NightsScreen.tsx`,
  `LevelVote.tsx` (inline vote through `useSeriesLevelRating`, replay of a held vote through `pendingLevelRating`),
  `nightsUi.tsx` / `nightsStyles.ts` / `useBrowseHref.ts` (small shared bits; Home imports them, both folders are mine).
- `src/modules/dancer-app/screens/home/`: `HomeScreen.tsx` (greeting, paused banner, linked notice, hero, 2x2 tiles),
  `RateNudge.tsx`, `WhatsOn.tsx` (reuses `useCalendarEvents`), `homeCopy.ts`, `useMyDancerEdit.ts` (see deviations).
- `tests/client/dancerAppHomeNights.test.tsx` (47 table-driven tests), `tests/e2e/dancer-app/home-nights.spec.ts` (added to `test:e2e` in `package.json`).
- No existing main-site file, no W1 shared file and no level-rating file was edited. `package.json` change = the spec name only.

## Decisions and INTERFACE deviations
1. **`useMyDancerEdit` was not exported by W1** -> written in `screens/home/useMyDancerEdit.ts` with the pinned key `['my-dancer-edit', userId]`
   (`// ORCHESTRATOR:` note in the file). Duplicate to remove when W1's lands; Nights imports it from Home's folder.
2. **Series id = `event_id`** of the attendance row (the event page passes `eventId` as `seriesId` to `LevelRatingPrompt`). Votes are keyed by it, never by date.
3. **Incomplete profile is fail-open like the event page**: the tap goes to the server; `profile_incomplete` makes the hook stash the vote and the row shows
   "Finish your profile to rate." + a link to `/app/welcome`. The held vote replays in `LevelVote` once `my_dancer_edit.complete` is true.
4. **CityContext**: production has a `CityProvider`; W1's `renderInShell` does not mount one, so `useActiveCitySlug` catches the throw and returns null
   (the Home calendar then shows no events and "Browse" falls back to `/parties`). Suggest `renderInShell` mounts `CityProvider`.
5. **No "N going" count on the hero** (the attendance read does not return it; no new RPC allowed). Hero shows date, place, time and Going/Interested.
6. Nudge: past, status Going, 1..7 London days ago, not a festival, series not yet rated by the person; ONE card, links to `/app/nights?focus=<seriesId>`.
7. `focus` param outlines the most recent past row of that series and scrolls it into view.
8. Stats strip (release 2) renders nothing. Views and Practice-partners tiles are dashed "Coming soon", no digits, no button.
9. `dancer_app_entered` fires once per browser session (sessionStorage flag, try/catch), only when `trackDancerEvent` reports it was sent (signed in).
10. W1-finish round-2 (whatsapp drop, error copy) is not touched by these screens; nothing here saves a profile.

## PERF GATE: orchestrator decision needed (`check:bundle-budget` is RED)
Reusing `useSeriesLevelRating`/`levelRatingModel`/`pendingLevelRating` and `useCalendarEvents` (both mandated by the brief) in the `dancer-app` chunk makes rollup cut new shared chunks:
- `dancer-app` first load 41 -> **47 chunks** (allowance 41), 313.8 KB vs budget 310 KB.
- `event (/event/:id)` 47 -> **48 chunks** (allowance 47): the level-rating modules, formerly inside the event chunk, are now shared with `dancer-app`. This is a cost on a hot route.
- I tried `lazyWithRetry` for `RateNudge`/`WhatsOn`/`LevelVote`: the extra chunks leave the first load, but the gate then fails with
  `perf-budgets.json entry "src/modules/dancer-app/dancer-app.tsx" is not in the client manifest` (the lazy children import from the entry chunk, so the manifest key becomes `_dancer-app-<hash>.js`).
  Reverted to static imports because that leaves a measurable gate. Options: raise `perf-budgets.json` (dancer-app 47/budget ~315, event 48) with this justification, or teach the gate the underscore manifest key and use lazy children. `perf-budgets.json` is W1's seam file; I did not edit it.

## Shapes surveyed
Prod read-only survey NOT RUN by this worker (cloud session had no usable Supabase MCP call made; no data fetched). Shapes come from W1's `DANCER_SHAPES` survey (152 profiles, 15 with a role, 97 with a photo, 91 with a city) plus the attendance shapes the brief lists.
Home/Nights shapes covered: no attendance; one upcoming Going; one Interested; past unrated 2d / 7d / 8d; past Interested only; past rated; past festival; incomplete (held vote, replay); paused; linked first visit / dismissed; no city; no profile; every signed-in `DANCER_SHAPES` entry renders Home.

## Red-first proof (mutants, both reverted)
- Mutant: views tile renders "12 views" -> `Home x attendance shapes > shows no fake numbers` FAILED: `expected 'Views this month12 views' to match /Coming soon/`.
- Mutant: `LevelVote seriesId={night.seriesId + night.date}` (per occurrence) -> 3 tests FAILED: `vote: ... REPLACES` (`expected [ …(1) ] to have a length of 2 but got 1`), `nudge disappears after voting` (`expected <a class="da-card da-tap" …> to be null`), `incomplete ... HELD` (`expected [ [ 's12026-10-13', 'mixed' ] ] to deeply equal [ [ 's1', 'mixed' ] ]`).

## CI per-job table (run locally; real GitHub results win when they run)
| job / step | command | result |
|---|---|---|
| unit (new file) | `npx vitest run tests/client/dancerAppHomeNights.test.tsx` | 47/47 pass |
| unit (dancer-app + client dirs) | `npx vitest run tests/client src/modules/dancer-app` | 364 pass, 1 fail: `dancerAppApi fetchGate` (also fails on the untouched base, verified by stash) |
| full `npm run test:unit` | | 18 fail, all unrelated: `*.contract.test.ts` (need live DB), `integrityCouldNotRun`, plan-hygiene; none touch these files |
| typecheck | `npm run typecheck` | 96 errors (baseline 106), none in dancer-app |
| eslint (my files) | `npx eslint src/modules/dancer-app/screens tests/client/dancerAppHomeNights.test.tsx` | 0 errors, 0 warnings |
| build | `npm run build` / `build:ship` | pass |
| wallclock brand | `npm run check:wallclock-brand` | pass (after switching to `wallClockTimeKey`; first run caught my `String(occurrence_starts_at)`) |
| bundle budget | `npm run check:bundle-budget` | **RED**, see above |
| isolation | `npm run check:dancer-area-isolation` | COULD NOT MEASURE: protected entries match no file on `origin/main` (6 paths; W1/R0 issue, pre-existing, not from this branch) |
| integrity | `npm run check:integrity` | NOT RUN: `bin/check-integrity.sh: Permission denied` in this sandbox |
| pre-ship eslint (scoped) | | flags files I did not touch (`publicDancerNames.ts`, `renderInShell.tsx`, ...), baseline commit mismatch |
| Playwright | `home-nights.spec.ts` | NOT RUN to a verdict: W1's own `reachability.spec.ts` signed-in tests fail identically in this sandbox (session fake never signs in, lands on /auth). Spec is written. |

## 390x844 walk
NOT DONE (no screenshots in `docs/handover/dancer-rebuild-w2b/`): see Playwright above. Walk for the orchestrator/CI: run
`npx playwright test tests/e2e/dancer-app/home-nights.spec.ts` where the organiser fake signs in (CI); it writes `home-<shape>.png` and `nights-<shape>.png` for
empty, upcoming-going, past-unrated-nudge, paused-linked into `docs/handover/dancer-rebuild-w2b/`. Check by eye: hero text wraps, tiles >= 112px, no horizontal scroll, 44px targets.

## Verified / Not verified
Verified: the 47 unit tests (mapper shared by Home and Nights, vote per series, replace, held + replay, nudge window and clearing, no fake numbers, empty states, analytics once and never signed out); lint; typecheck count; production build; wallclock guard; two mutants go red.
Not verified: any real browser render (Playwright/screenshots), prod-shaped data survey, the perf gate (RED, needs a decision), integrity script, isolation check, real GitHub CI, a phone.

## What is left
Orchestrator: decide the perf-budget question; swap `useMyDancerEdit` for W1's; mount `CityProvider` in `renderInShell`; run the Playwright spec in CI and add the screenshots.
