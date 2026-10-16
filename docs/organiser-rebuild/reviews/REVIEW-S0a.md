# REVIEW-S0a -- independent review of slice S0a (shell)

Reviewer ticket `dt_d45a04aef07c`, brief `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/R-S0a.md` (blob d9770f7b).
Slice branch `claude/org-r1-shell` @ `ecfe6b3` (2 commits on `origin/main` `ecc3432`). Reviewed 2026-10-16, ONE pass, effort xhigh.
Read: 00-COMMON.md, S0a-shell.md, R1-PLAN.md 4.1, 4.2, 4.3 #1 #2, 4.4 (S0a row), 4.5 Shell, 4.11 shell lines, D18/D32/D44/R3-16, the author's handover, the full diff.

## Verdict: 0 BLOCKING / 3 SHOULD / 6 NOTE -- mergeable after the fix pass for SHOULD-1, SHOULD-2 and SHOULD-3a

The pinned interfaces (4.3 #1, #2) are honoured, no protected file is touched, every test the brief names can fail (mutation evidence below), and every CI step that can run here is green or red the same way on `main`.

## Findings

### SHOULD-1 -- the bottom safe area is lost on every screen without an action bar
`src/modules/organiser/shell/OrganiserShell.tsx:108` (and the deleted `TabBar.tsx:12`). On main the TabBar carried `paddingBottom: env(safe-area-inset-bottom)`; now only the action bar does (`:126`). Home, Events, Team, Page and every placeholder have no action bar, so on an iPhone with a home indicator the last row of the scroller (e.g. Home's "Add another organiser", see `S0a/home-390.png`) can only scroll to 16px from the bottom edge, under the 34px indicator. Shell children measured at 390x844: `["HEADER","org-content"]`, so nothing pads the bottom.
**Fix:** give the `org-content` scroller `style={{ paddingBottom: actionBar ? undefined : 'env(safe-area-inset-bottom)' }}` and add a `routes.test.tsx` case asserting the style when `actionBar` is absent.

### SHOULD-2 -- `paths.test.ts` does not prove `encodeURIComponent` on `addDate`'s `date` argument
`src/modules/organiser/shell/__tests__/paths.test.ts:9` uses `DAY = 'day-1'`, which has nothing to encode. The comment on lines 4-5 says the ids "prove encodeURIComponent on every argument". Mutant `addDate: .../${id(seriesId)}/${date}` (no encode) **survives**: `Tests 3 passed (3)`.
**Fix:** set `DAY = 'day 1'` and expect `addDate: '/account/o/add/s%201/day%201'` (the `routes.test.tsx` row `/account/o/add/s1/day-1` can stay).

### SHOULD-3 -- the three deprecated aliases: acceptable for the merge, but two have no owner slice and one has no caller
Judgement on brief item 3: **YES, acceptable** -- each alias is marked `@deprecated` in `paths.ts:56-65` and listed under a "Deprecated" comment in `paths.test.ts`, each lands (replace) on its R1 path (`legacy.test.tsx` proves it), and removing them now would break files outside S0a's row. But the condition "each has a named owner slice" holds for only part of it. Callers today (`grep ORG_PATHS.(newEvent|date|profile)`):

| Alias | Callers | Owner by 4.4 |
|---|---|---|
| `newEvent` | `home/index.tsx:54`, `events/EventList.tsx:54`, `edit-in-place/parts.tsx:223` | S1, S5, **nobody** (`edit-in-place/**` is "untouched" for S7, not owned) |
| `date` | `home/index.tsx:33,167`, `events/EditorRows.tsx:37,83` | S1, **nobody** (`EditorRows.tsx` is a must-keep event-truth file, not in S5's row) |
| `profile` | **none** | -- |

- **SHOULD-3a (fix worker):** `profile` has no caller anywhere in `src/` or `tests/`. Delete `paths.ts:64-65` and its line in `paths.test.ts`; keep the `/profile` legacy route and `moduleLegacyPath('profile')` (bookmarks).
- **SHOULD-3b (orchestrator, not the fix worker):** assign `edit-in-place/parts.tsx:223` and `events/EditorRows.tsx:37,83` to a slice (S7 / S5 are the natural owners) or accept that `newEvent` and `date` stay as permanent redirecting aliases. Until then the "each goes when its slice lands" comment at `paths.ts:57-59` cannot come true.

### NOTE-1 (orchestrator) -- `e2e-smoke` will be red on this slice and on `feat/organiser-r1` until S8
Full `npm run test:e2e` here: **142 passed, 5 failed, 1 flaky**. The 5 reds are the ones the brief hands to S8: `organiser-home.spec.ts:11,31,57` and `organiser-events.spec.ts:257` assert main's URLs (now redirected to `/new/what`, `/change/:s/:o`), `organiser-loop.spec.ts:14` clicks `org-tab-profile` (no tabs, D32). Not a code fault of S0a (the brief forbids editing those specs), but the e2e gate stays red for waves 1-5. Decide: accept the red until S8, or let the S0a fix pass update the four URL expectations (one-line regex changes) and mark `organiser-loop` for S8.

### NOTE-2 -- one load-sensitive flake, as the author predicted
`dancer-home.spec.ts:150` "I organise events opens the unchanged onboarding" failed once in the full run (`page.evaluate: Execution context was destroyed ... navigation` in `expectNoHorizontalScroll`), passed on retry, and passed **6/6** alone (`--repeat-each=6 --retries=0`). The account gate waits on two reads (completion + deletion) where `DancerProfileGate` waited on one. Watch it in CI; no change asked.

### NOTE-3 -- `'deleted'` renders a blank frame with no way forward
`OrganiserRoutes.tsx:74`. Exactly what 4.1/4.3 pin ("renders nothing; signInLanding routes"), so not a finding against the slice. But a signed-in person whose deletion is pending who opens `/account/o` from a bookmark or another tab never passes the sign-in landing and sees an empty page (CLAUDE.md: "every empty state says what the person can do"). Owner/orchestrator call: `'deleted'` -> `Navigate replace` to `restorePathFor(pathname+search+hash)` from `lib/accountRouting` (reuse, one line) would close it.

### NOTE-4 -- `'signed-out'` inside `AuthGuard` is now blank too
`OrganiserRoutes.tsx:74`. `AuthGuard` only redirects when there is no user; an anonymous Supabase session (`is_anonymous`) passes it, and the gate then says `signed-out` -> null. On main `DancerProfileGate` let it through. Only `src/lib/devAuthBypass.ts:104` creates anonymous sessions, so no prod person meets this.

### NOTE-5 -- `noHandBuiltLinks` allowlists by file, not by hit
`noHandBuiltLinks.test.ts:10`. A second literal planted in `home/onboarding/EmailCode.tsx` (already in `KNOWN`) would pass. Fine while S9 is the only owner of that file and must delete the entry; a per-file hit count would close it. Also: the scan covers `.ts` as well as `.tsx` (stronger than the plan asked).

### NOTE-6 -- route parameter `:userId` vs D50's `profile_id`
`paths.ts:47,49` name the argument `userId`, as the brief's route table does. 4.11 (#10, D50) keys the team browse rows and `organiser_team_add_member_by_profile_v1` by `profile_id`. S6 should decide which id the URL carries; the string shape is the same, so no change in S0a.

## Checks against the brief

### 1. Files touched (`git diff --name-only origin/main...origin/claude/org-r1-shell`)
```
docs/organiser-rebuild/handovers/S0a.md
src/modules/organiser/__tests__/legacyRedirect.test.tsx        (deleted)
src/modules/organiser/__tests__/shell.test.tsx                 (deleted)
src/modules/organiser/shell/LegacyRedirect.tsx
src/modules/organiser/shell/OrganiserRoutes.tsx
src/modules/organiser/shell/OrganiserShell.tsx
src/modules/organiser/shell/TabBar.tsx                         (deleted)
src/modules/organiser/shell/__tests__/{gate.matrix,legacy,routes}.test.tsx, {noHandBuiltLinks,noTabs,paths}.test.ts, sourceScan.ts
src/modules/organiser/shell/index.ts
src/modules/organiser/shell/legacyPaths.ts
src/modules/organiser/shell/paths.ts
src/modules/organiser/shell/placeholders.tsx                   (allowed by S0a-shell.md)
src/modules/organiser/shell/tabs.ts                            (deleted)
tests/e2e/organiser-legacy-redirects.spec.ts                   (one expected target)
tests/regression/today/__snapshots__/account.today.test.tsx.snap
```
All inside the allowed set. Protected-file grep over that list (`accountGate|src/lib/account|src/pages/Account|AnimatedRoutes|vite.config|scripts/check-|db-contract|event-page|calendar|useKeyboardInset|keyboard`): **no hit**. `AnimatedRoutes.tsx` untouched.
Snapshot diff, `sort | uniq -c` of changed lines: `10 x -navigation "Organiser"` and `10 x` each of the four tab links (Home / Events / Team / Profile) removed; the only `+` lines are the same two strings re-terminated (`href=/",`, `href=/account/o?add=1",`) because the removed block was the last in its string. Removal-only in content (D32).

### 2. Pinned interface 4.3 #1 -- PASS
`AccountGated` (`OrganiserRoutes.tsx:68-75`): `complete` -> children; `incomplete` -> `Navigate replace` to `finishProfileHref(pathname+search+hash)` imported from `@/lib/profileCompletion` (reused, not re-implemented); `loading` -> `ShellFallback` (`org-route-loading`); `deleted` / `signed-out` -> `null`. `useAccountGate` from `@/lib/accountGate` is the only gate read. `grep -rln DancerProfileGate src/modules/organiser`: only two comments in `edit-in-place/__tests__`; no import. `AuthGuard` + `useNoindexMeta(true)` + `PrefetchOrganiserHome` kept; one lazy chunk per folder kept (the placeholder groups share one `./placeholders` chunk). Same fail-closed answer as main for a failed completion read (`dancerGate('error') = 'gate'` on main; `composeAccountGate` maps `error` -> `incomplete`).

### 3. Pinned interface 4.3 #2 -- PASS (aliases: see SHOULD-3)
`ORG_PATHS` against the S0a-shell.md route table (4.1 as amended by D44): every route present, none missing, none differently shaped -- `home, switch, change, changeEvent, changeDate, changeTime, changeVenue, changeDay, add, addEvent, addDate, cancel, cancelEvent, cancelDate, newWhat, newName(format), newVenue, newDate, newTime, newCover, events, event, eventDetails, team, teamAdd, teamPerson, handover, handoverTo, page, more, cover, done`. Extra: the three deprecated aliases only. Every id goes through `id = encodeURIComponent`; `newName('one_off'|'recurring')` = `/account/o/new/name?format=...` (tested both values). `paths.test.ts` pins the table with a literal `toEqual` instead of a snapshot file (stronger: an extra or missing key fails).

### 4. Legacy redirects -- PASS
`legacy.test.tsx` (18 rows, green): `/account/o/events/new -> /new/what`, `/account/o/events/:s/dates/:o -> /change/:s/:o`, `/account/o/profile -> /page` (query + hash kept, history REPLACE); `legacyAccountPath('new') -> /account/o/new/what` (+ `?organiser=`); `series`/`team`/home targets unchanged. `AnimatedRoutes.tsx` untouched.

### 5. Tests that can fail -- mutation evidence
Baseline: `npx vitest run src/modules/organiser/shell` -> `Test Files 6 passed (6) / Tests 67 passed (67)`. Each mutation applied with `sed`, run, then `git checkout` / `rm` (the tree is clean: `git status --short` shows only this review).

| # | Mutation | Test | Result |
|---|---|---|---|
| a | gate renders on `'incomplete'` too (`status === 'complete' \|\| status === 'incomplete'`) | gate.matrix | **RED** `FAIL ... > incomplete -> /finish-profile` `Unable to find an element by: [data-testid="where"]` `Tests 1 failed \| 4 passed (5)` |
| a2 | gate renders on `'deleted'` and `'signed-out'` | gate.matrix | **RED** `FAIL ... signed-out -> AuthGuard only`, `FAIL ... deleted -> nothing` `Tests 2 failed \| 3 passed (5)` |
| a3 | re-wrap the area in `DancerProfileGate` | gate.matrix | **RED** `FAIL ... complete -> the shell` `Tests 1 failed \| 6 passed (7)` |
| b | plant `export const X = '/account/o/team';` in `home/Plant.tsx` | noHandBuiltLinks | **RED** `FAIL ... only shell/paths.ts spells the base` `AssertionError: expected [ 'home/Plant.tsx' ] to deeply equal []` `Tests 1 failed \| 2 passed (3)` |
| c | `import { TabBar } from './TabBar';` in `OrganiserShell.tsx` | noTabs | **RED** `FAIL ... no source file imports or names them` `expected [ 'shell/OrganiserShell.tsx' ] to deeply equal []` |
| c2 | `import { NAV } from '../shell/tabs';` in `home/Plant2.ts` | noTabs | **RED** `expected [ 'home/Plant2.ts' ] to deeply equal []` |
| d | `legacyPaths.ts` `profile -> ORG_PATHS.home` | legacy | **RED** 3 failed (`/account/o/profile -> /account/o/page` x2, `encodes the ids`) `Tests 3 failed \| 15 passed (18)` |
| e | delete the `team/:userId` route | routes | **RED** `FAIL ... /account/o/team/u1 -> Team` `Tests 1 failed \| 35 passed (36)` |
| f | `addDate` without `encodeURIComponent` on `date` | paths | **SURVIVES** `Tests 3 passed (3)` -> SHOULD-2 |

### 6. CI job steps in the sandbox (branch head `ecfe6b3`)

| Job | Command | Exit | Note |
|---|---|---|---|
| typecheck | `npm run check:rpc-typing` | 0 | the CI job's steps |
| typecheck | `npm run check:wallclock-brand` | 0 | |
| (extra) | `npm run typecheck` (`tsc -p tsconfig.app.json`) | 2 | 96 errors; `origin/main` in a worktree: 96, sorted file lists **identical**; none in a file S0a touches (the one organiser hit is `edit-in-place/__tests__/TeamPicker.test.tsx:297`, pre-existing). Not a CI step |
| unit-tests | `node scripts/check-dancer-area-isolation.mjs --self-test`; `npm run check:dancer-area-isolation` | 0; 0 | |
| unit-tests | `npm run test:unit:offline` | 1 | `338 files, 8514 passed, 5 failed, 26 skipped`. All 5 reds are `tests/integrityCouldNotRun.test.ts`; on `origin/main` the same file: `Tests 5 failed \| 62 passed` (sandbox environment, not this slice) |
| architecture-guard | `bin/check-integrity.sh` (after the CI's `chmod +x bin/*.sh`), `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths(:self-test)`, `check:plan-hygiene:self-test`, `check:workflow-artifact-policy(:self-test)`, `check:mojibake:self-test`, `prove:entry-point(:self-test)` | all 0 | |
| lint | `npm run lint` | 0 | (with `bin/*.sh` executable, as CI does) |
| perf-budget | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test`, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | all 0 | `check:lighthouse` needs a deploy: not run |
| e2e-smoke | `npx playwright test tests/e2e/organiser-layout.spec.ts tests/e2e/organiser-legacy-redirects.spec.ts` (+ the review walk) | 0 | 24 passed |
| e2e-smoke | `npm run test:e2e` (CI=1, flag on) | 1 | 142 passed, 5 failed (S8's, NOTE-1), 1 flaky (NOTE-2) |
| types-drift | `npm run gen:types` | not run | needs the Supabase token; S0a changes no types |

### 7. Phone size (390x844, mocked gate via `tests/e2e/helpers/organiserFake.ts`)
A throwaway spec (deleted, not committed) opened each state with `openOrganiser`, asserted no `org-tabbar` / `org-tab-*` / `nav[aria-label=Organiser]`, `expectNoHorizontalScroll`, and the placeholder's `data-route`. All green.
- `S0a/home-390.png` -- Home, no tab row, shell children `["HEADER","org-content"]`, no sideways scroll.
- `S0a/placeholder-change-390.png`, `S0a/placeholder-more-390.png`, `S0a/placeholder-done-390.png` -- placeholders render their name with a "Home" back link.
- `S0a/page-390.png` -- `/account/o/profile` lands (replace) on `/account/o/page` with main's profile screen.

## Verified
- Diff scope, protected files, snapshot removal-only (commands and output above).
- 4.3 #1 and #2 read line by line against the code; the route table key by key.
- Every brief mutation (a, b, c) goes red, plus six of my own; one survives (SHOULD-2).
- Every CI step that can run in this sandbox, per job, with `origin/main` baselines for the two non-zero exits.
- 390x844 walk on the mocked organiser fake: no tab row, no horizontal scroll, placeholders named.

## Not verified
- The walk ran against the Playwright config's server (`npm run dev`, react-router SSR dev), not `vite preview` of the production build: this app's build is SSR (`build/server` + `build/client`) and the e2e helpers are wired to the config's server. The production build itself was built and passed the perf-budget gates.
- SHOULD-1 is reasoned from the code and main's TabBar style; Chromium reports `env(safe-area-inset-bottom) = 0`, so no screenshot can show it. No real phone.
- No prod data read: S0a reads no data of its own; the mocked fake carries the prod shapes the e2e helpers model.
- `types-drift`, `check:lighthouse`, Vercel preview: not run (token / deploy needed).
