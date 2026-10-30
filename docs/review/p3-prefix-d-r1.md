# Review r1: PR #1180, p3-prefix-d (door list answers, P3 route boundary, 44px taps)

Independent, read-only review (Fable; the builder was Opus). Branch `claude/p3-prefix-d-door` at
`711b4d0` against `origin/main` `1dc1660` (the merge base; the branch is three commits on top of it,
10 files, +343/-19). Review brief: `docs/briefs/review-1180.md`. One round, no fixes by me.
Prod read on 2026-10-30: `pg_get_functiondef` of `ticket_door_list_v1` only (no data, no writes).

## Verdict: FIX FIRST

The three claims hold. `parseDoorList` now throws on anything that is not a whole `ok` or an explicit
`not_allowed`, so a null, a list, a new result word or a half answer reaches the screen as "Could not
load tonight's list" with Try again, and the Scan tab keeps its camera and code box; the live function
answers exactly those two words, so nothing real is pushed into the error path. `P3RouteBoundary`
sits around every lazy P3 route (eight directly in `P3Routes`, the eleven `/you/*` screens through
`P3YouSurface`) and I proved it catches a rejected lazy import and a plain render throw, in all three
frames, with a Try again that reloads and a back link that is never the page already showing. Every
named tap target measures at least 44x44 in Chromium at 390px with the real P3 CSS. The new tests
fail on main (18 of 25), the organiser tree is green (206 files, 8069 tests), and the bundle budget
is byte-identical on main and the branch.

Two things stop it being ready, neither a code redesign:

1. **The PR body is still the bot template** ("TO FILL" x3, no Phone QA section). CLAUDE.md's
   definition of done requires the Verified-on-real-data block, and `phone-qa-section` is red
   because the body has no `## Phone QA`. The title still says "(checkpoint)".
2. **Offline, the door's list tab says "Loading tonight's list..." for ever** and offers no Try
   again (S2). It is pre-existing, but it is one of the six rows the brief asks for, the door is the
   one P3 screen used in a basement with no signal, and the fix is one line.

## 1. Door: every list answer x what the screen says and offers

Read from `DoorScreen.tsx` (unchanged by this PR) + `data.ts` (changed) + `model.ts`; the rows marked
"test" are exercised by `door.listShape.test.tsx`; the rest are read from the code.

| Answer from `ticket_door_list_v1` | Scan tab | Tonight's list tab | Says what to do? |
|---|---|---|---|
| `ok` with rows (test) | camera + code box; tab label shows `(total)` | search, counter, rows; "Read only: to check someone in, scan or type their code" | yes |
| `ok`, 0 rows, `total_count` 0 | "No tickets sold yet" card + "Go to the event page"; camera off | same card | yes |
| `not_allowed` (test) | CANNOT CHECK TICKETS card, no camera, no code box | same card | yes: "Ask the event's organiser to add you to their team, then open this screen again" (the back link is the way out) |
| null / `[]` / unknown `result` / no `result` / `ok` without a rows list (tests, all threw as `DoorListShapeError`) | camera + code box, tab label without a count | after the query's one retry (~1 s): "Could not load tonight's list. Check the signal, then try again. Scanning still works when it is back." + Try again | yes |
| RPC error / thrown (test) | same as above | same as above | yes |
| RPC error `42501` (signed out) | "You were signed out" + Sign in again (reload), both tabs | same | yes |
| **offline from the start** (not tested) | camera + code box | "Loading tonight's list..." + Back to scanning, **indefinitely** (react-query's default `networkMode: 'online'` pauses the fetch; `isPending` stays true, `isError` never) | **no**: the copy is false and nothing says the signal is the reason. See S2 |
| offline after a good load | camera + code box; a scan that fails -> NO SIGNAL card -> "Open tonight's list" | the last-loaded list with the "NO SIGNAL ... loaded at HH:MM" banner | yes (this is the designed path) |
| **timeout** (server hangs) | camera + code box | "Loading..." until the browser gives up on the fetch (no client-side timeout anywhere in the chain), then the retry, then the error card | eventually |

Disabled controls: the Check button is disabled with a reason (`codeBoxBlock`); the error card's
Try again is disabled while `isFetching` with no label change (L2). No copy points at a missing
control: "scan or type their code" has both controls on the Scan tab; "open this screen again" has
the back link.

Prod shape: `ticket_door_list_v1` returns `jsonb_build_object('result','not_allowed', rows '[]',
truncated false, in_count NULL, total_count NULL)` when `_ticket_door_orgs_v1` is empty, else
`('result','ok', rows, truncated)` merged with `_ticket_door_counts_v1`, and raises `42501` when
`auth.uid()` is null. So the parser's two accepted words are the live function's two words, and
the "throw on anything else" rule cannot hit a real answer today. One real-shape note (L5): an
unknown or deleted series id yields an empty org list and therefore `not_allowed`, so a stale door
link reads as "You're not on this event's team". Database-side, pre-existing, out of this PR.

## 2. The route boundary

**Catches a failed lazy chunk, with a working retry.** `P3Routes.boundary.test.tsx` mocks
`lazyWithRetry`'s one reload as already spent (`attemptChunkReloadOnce: () => false`) and makes the
module's export getter throw the browser's own "Failed to fetch dynamically imported module" text,
so the real `safeDynamicImport` path rethrows into the boundary. All five cases pass on the branch and
all five fail on main (no `p3-route-error` is ever rendered there). Try again is
`window.location.reload()`, which is the only retry that can work: React caches a rejected `lazy()`
promise, so re-rendering would fail again. After that manual reload the sessionStorage flag is still
`1`, so a chunk that still fails goes straight back to the card (no reload loop), and a chunk that
loads clears the flag (`clearChunkReloadFlag`). A stale chunk is reported only once the reload has
been tried (`componentDidCatch`), a render bug always; the global `ErrorBoundary` no longer sees
either, so nothing is double-reported.

**Wraps every lazy route.** Enumerated from `P3Routes.tsx` and `surface.tsx`:

| Route(s) | Lazy? | Boundary | Frame | Back |
|---|---|---|---|---|
| `you/details`, `start`, `events/:id/door` | yes | `lazyScreen` | own (draws `.p3-theme.p3-frame`, top bar, main) | You / Home / Event |
| `events/:id`, `/dates`, `/details`, `/prices`, `/history` | yes | `lazyScreen` | tab (card in P3Shell's main) | Events / Event |
| `you` index + `switch`, `welcome`, `page`, `team`, `team/add`, `team/:userId`, `handover`, `handover/:userId`, `done`, `add` | yes (11) | `P3YouSurface`'s boundary around the Outlet | tab for `/you`, pushed otherwise (own top bar, P3Shell keeps the tab bar) | You (omitted on `/you` itself) |
| index, `events`, `stats`, `you/get-paid` | no (static) | none (global boundary as before) | | |

The frame choice is right in each case: the test asserts exactly one `<header>` and one `<main>` for
the You hub and for a pushed screen, so no doubled top bar. The boundary is keyed by `pathname`, so
navigating away always starts clean.

**Bytes.** `perf-budgets.json` and `vite.config.ts` are untouched. `npm run build` +
`npm run check:bundle-budget` with `perf-budget.yml`'s placeholder Supabase env, on main and on the
branch: every route identical to the byte and to the chunk (home 212.5 KB / 36, event 380.4 / 40,
auth 298.9 / 26, dancer-app 373.9 / 47, parties and classes 272.0 / 41, faq 238.0 / 23, landing
238.2 and 237.3 / 23; all pullers at allowance; exit 0 both). That comparison is partly vacuous: with
the organiser flags off the P3 area is not emitted at all (no `P3Routes` chunk in either manifest),
exactly as the r1 review of PR #1130 found. Re-measured with every `VITE_ENABLE_ORGANISER*` flag on:
every budget verdict line identical on main and the branch again (home 213.0 KB / 36, auth 300.6 /
27, and the same two chunk-ratchet OVERs on both, auth 27 vs 26 and dancer-app 48 vs 47, which is the
flags-on build's own pre-existing state, not CI's config and not this PR). The lazy P3 chunk itself:
`P3Routes-*.js` 20.9 -> 21.6 KB gz (+0.7 KB, the boundary) and its CSS 4.2 -> 4.4 KB (+155 B, the
switch and the two tap rules); `DoorScreen-*.js` +67 B (the shape guard); `PricesScreen-*.js` +16 B;
the page editor and Team chunks byte-identical. None of that is first-load for any budgeted route.
By construction the boundary can only land in the lazy P3 chunk: its two first-party
imports (`staleChunk`, `reportClientErrorLazy`) are already on every route's first load, and
`p3.css` is already imported by `P3Shell`.

## 3. Tap targets at 390x844

Measured with Playwright Chromium at 390px, `html { font-size: 13.5px }`, the branch's `p3.css` +
`door.css` + the edit-in-place `LAYER_CSS` loaded verbatim, the markup copied from the components.
All P3 sizes are px (`--tap: 44px`), and the Team links use Tailwind's `min-h-[44px]`, which is
literal px.

| Control | Rule | Measured |
|---|---|---|
| Sheet Close (`Sheet.tsx`, `StackSheet.tsx`) | new `.p3-sheet-head .p3-link { min-width: var(--tap) }` + `.p3-link` min-height 44 | 44x44 (StackSheet Back 66x44, Close 54x44) |
| Prices "It's free" switch | input `position:absolute; inset:0` over the `.p3-check` row (min-height 44) | row and input 366x46 |
| Page editor compact pencils (Edit city / year / category) | new `.p3-theme .eip-pencil--compact { width/min-width: var(--tap) }` beats the layer's `.eip-pencil--compact{width:32px}` on specificity (0,2,0 vs 0,1,0), height 44 inline | 44x44 |
| Team "Back to the team" (`AddSomeone.tsx:113`, `Person.tsx:84`) | `inline-flex min-h-[44px] items-center` | 94x44 |
| Door: back link, tabs, code input, Check, result buttons, Try again, search | pre-existing `door.css` / `.p3-link` (this PR changes nothing in the door's CSS) | 55x44, 195x52, 294x52, 88x52, 390x56, 390x44, 390x44 |
| Boundary card: back link, Try again | `.p3-back` 44 min, `.p3-btn` 44 min | 398x44 (stretched, see L3), 104x44 |

Not a browser walk of the real screens with prod data (no credentials in this environment); the
CSS the walk would exercise is the CSS measured.

## 4. Do the new tests fail on the unfixed code?

Both test files copied unchanged onto a clean `origin/main` worktree:
`P3Routes.boundary.test.tsx` 5/5 fail; `door.listShape.test.tsx` 13/20 fail (all six `parseDoorList`
throw cases, the six matching screen cases, and the Try-again case). The seven that pass on main are
the rows main already got right (`ok`, `not_allowed`, an RPC error, a thrown fetch, and the jsQR
chunk case), so they are regression guards rather than proof of the fix. On the branch 25/25 pass.

## 5. Tests, lint, types, CI

- `vitest run src/modules/organiser` on the branch: 206 files, 8069 passed, 2 skipped, 0 failed.
- `eslint` on the ten changed files: 0 errors, 2 pre-existing fast-refresh warnings.
- `tsc --noEmit -p tsconfig.app.json`: the same pre-existing error set on main and on the branch
  (none in a changed file).
- CI on `711b4d0`: unit x3, build-smoke, bundle-budget, integrity, contract-check, e2e-smoke and
  the rest green. Red: `phone-qa-section` (this PR's body, F1) and `phone-qa` (the phone suite dies
  at `src/lib/featureFlags.ts:12`, `import.meta.env` undefined under Playwright; PRs #1181, #1182,
  #1183 and #1164 fail identically at the same line, so it is base-wide, not this PR's).
- `safe-edit`/`safe-write`, HTML entities (`&lsaquo;`, `&hellip;` in JSX; `’` only in the
  pre-existing `model.ts`), no raw Unicode punctuation in the new files: fine.

## Findings

### Block

None.

### Should-fix (before merge)

**S1. PR body and title.** Body is the bot template: "Shapes surveyed / Checks run / NOT verified:
TO FILL" and no `## Phone QA` section, so `phone-qa-section` is red and the definition of done is
unmet; the title still carries "(checkpoint)". Fix: fill the three lines (the shape survey is the
function body above plus the counts of `ok`/`not_allowed` the builder saw), add the Phone QA
section in the format `scripts/check-pr-phone-qa.mjs` prints, drop "(checkpoint)".

**S2. Offline, the list tab says "Loading tonight's list..." for ever.** `DoorScreen.tsx:45-51`
leaves `networkMode` at react-query's default `online`, so with `navigator.onLine` false the query
pauses in `isPending` and the card at `DoorScreen.tsx:283` (Loading + Back to scanning) never gives
way to the error card at `:287` (Could not load + Try again). The copy is false and the person is
not told the signal is why. Pre-existing, but the brief's table asks for this row and the door is
the screen with the worst signal. Fix (one line, the pattern `Dancer4Flow.tsx:72` and
`JoinPage.tsx:75` already use): `networkMode: 'always'` on the list query, so an offline fetch fails
fast into "Check the signal, then try again"; or, if auto-resume on reconnect is wanted, branch on
`list.fetchStatus === 'paused'` and say "No signal. The list will load when it is back."

### Low

**L1. The sibling link was left at the old size.** `AddSomeone.tsx:111` "Go to Team" is the same
inline-link-in-a-paragraph pattern as the two links this PR fixed (`:113`, `Person.tsx:84`) and
still has only `underline`; so are `team/index.tsx:69` and `GateReason.tsx:11` ("Message us").
Fix: the same `inline-flex min-h-[44px] items-center`.

**L2. Try again is disabled without a reason while fetching.** `DoorScreen.tsx:289`
`disabled={list.isFetching}` keeps the label "Try again"; the house rule is that a disabled control
says why. Fix: label "Trying..." while `isFetching`, or leave it enabled (refetch is idempotent).

**L3. The 'tab' frame's back link stretches to the full column.** `P3RouteBoundary.tsx:55-60` puts
the `.p3-back` inline-flex link straight into `.p3-stack` (a flex column, default `align-items:
stretch`), so the whole 398px row is the tap target and a tap on the empty right side navigates.
Fix: `align-self: flex-start` on `.p3-back` inside `.p3-stack`, or wrap it in a `.p3-top-row`.

**L4. A slow chunk is still blank on the own-frame routes.** `lazyScreen` keeps
`<Suspense fallback={null}>` for the door, onboarding and you/details, so a chunk that is loading (not
failed) shows nothing until it arrives; `/you/*` has a Loading card. Pre-existing and outside D2's
"failed chunk" wording, noted because the PR title says "never go blank". Fix: a frame-matched
Loading card as `P3YouSurface` already does.

**L5. Real-shape note, database side.** `ticket_door_list_v1` answers `not_allowed` for a series id
that does not exist (empty org list), so a stale or mistyped door link reads as "You're not on this
event's team". Out of this PR; worth a line in the ticketing backlog.

### Nits

- `P3RouteBoundary` keyed by `pathname` also remounts the Suspense + Outlet subtree on every `/you/*`
  navigation and when `events/:a` becomes `events/:b`; harmless, and arguably the cleaner reset.
- `door.listShape.test.tsx` prints "Not implemented: HTMLMediaElement's play()" nine times; a
  `vi.spyOn(HTMLMediaElement.prototype, 'play')` stub would keep the run quiet.

## What I could not check

- A browser walk of the real door, sheets, Prices, page editor and Team at 390x844 with prod data
  (no credentials here). Tap sizes were measured on the real CSS in Chromium instead.
- The offline and timeout rows of the table (S2) are read from the code and react-query's documented
  behaviour, not run.
- The phone suite itself, which is red on the base for every open PR.

[worker-done review-1180]
