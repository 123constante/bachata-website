# REVIEW-S1 -- independent review of slice S1 (Home + Switch)

Reviewer brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/R-S1.md` (sha 95cf012). Ticket dt_94491639490c.
Reviewed: `origin/claude/org-r1-home` @ `620948f` against base `origin/feat/organiser-r1` @ `9807a49` (S0a + S0b merged).
One pass, as the brief says. Findings go back to S1 for one fix pass. The reviewer changed no source file.

## Verdict: 1 BLOCKING / 3 SHOULD / 6 NOTE

All six mutants the brief asked for go RED. One extra mutant, on behaviour the author added, stays green (S2).
Every prod shape has a matrix row. No protected file is touched.

---

## BLOCKING

### B1. New event's reason on Home points at a control that is not on screen (Send for review / Profile page)
- **Where:** `src/modules/organiser/home/homeView.ts:37-40` (`newEventBlock` -> `createBlock` -> `shared/organiserStatus.ts:38/59`). The test that pins it is `src/modules/organiser/__tests__/draftOrganiser.matrix.test.tsx:138` (S1's edit).
- **Why:** S1 removed the status card and the Send-for-review button from Home (D4). On a non-live page, Home still shows `organiserStatus().newEventBlock` under the disabled New event:
  - draft: "... **Send it for review first**; once the team approves it you can add events."
  - rejected: "... Make them on your **Profile page**, then **send it for review again**."

  Neither control exists on Home any more. "Profile page" is now "My page", and the review step is gone in R1. The edited matrix test asserts both things at once: that this text is shown (`toBe(copy.newEventBlock)`), and that `home-send-review` is absent. So the test pins copy that points at a missing control. The CLAUDE.md definition of done and this brief both make that BLOCKING.

  It is latent today: prod has 0 non-live organiser pages (query below), and D4 makes new pages live. But an admin can still park a page, and S1's own matrix covers exactly that case.
- **Fix:** make `newEventBlock` in `homeView.ts` return one R1 Home line for every non-live status that names no review step and no Profile page (e.g. `${name} is not live, so it cannot take events. Ask the Bachata Calendar team.`). Then have the matrix test assert that text and `not.toMatch(/review|Profile/)`.

---

## SHOULD

### S1. The chosen page does not reach the screens Home opens when it came from `?o=` (or when storage is unavailable)
- **Where:** `src/modules/organiser/switch/useOrganiserChoice.ts:37`, `home/index.tsx:30` (`navigate(job.to)`), `home/index.tsx:173` (`navigate(b.to)`).
- **Why:** Home resolves `?o=` first, but nothing stores that choice, and the links it opens (`/change`, `/add`, `/cancel`, `/team`, `/page`, `/events`, `/more`) carry no `?o=`. Each of those screens resolves the page again through `useOrganiserChoice`: localStorage first, then the first page.
  - **Case 1:** a shared link `.../account/o?o=B` (or Switch while localStorage throws) shows page B on Home. Tap Team or Change a date, and the next screen shows page A. The organiser can then edit the wrong page's dates.
  - The answer to the brief's 3(b): it can **never** pick a page the login is not a member of. `selected` is always found in the login's own `organiser_home_v1` list. The risk is a member page that is not the one shown.
  - Latent in prod: 0 logins have 2+ pages (query below).
- **Fix:** in `useOrganiserChoice`, call `rememberChoice(selected.id)` whenever `params.get('o')` resolves to a member page. Optionally, Home can also append `?o=<selected.id>` to every `Job.to` and small-button target, so the choice survives without storage.

### S2. The localStorage fallback the author added has no test (mutant survives)
- **Where:** `src/modules/organiser/switch/index.tsx:38` (`rememberChoice(id)`), `switch/__tests__/Switch.test.tsx`.
- **Why:** replacing `rememberChoice(id);` with `void id;` leaves home, switch and shell all green (122/122, output below). The behaviour the handover justifies ("without it, Switch would forget the choice after any flow") is untested.
- **Fix:** add a test that taps row 2 on Switch, then mounts a bare `ORG_PATHS.home`, and asserts `home-page-name` is row 2's name. Also add one test for S1's `?o=` remember.

### S3. A one-page login lost its only on-screen way to add a page
- **Where:** `tests/regression/today/__snapshots__/account.today.test.tsx.snap` (all 4 updated snapshots drop `link "Add another organiser" href=/account/o?add=1`). Also `home/index.tsx` (the Switch link only with 2+ pages) and `switch/index.tsx:76` ("Add a page" lives only on Switch).
- **Why:** on main, every Home had "Add another organiser". Now "Add a page" sits only on Switch, and Switch is only linked with 2+ pages. All 3 prod owner logins have exactly one page, so none of them can reach page creation from any control. The handover admits this (next step 4). It is the one line in the snapshot diff that is a capability loss rather than the C1b redraw. Every other line of that diff matches C1b exactly: heading = page name, the 4 first-steps buttons, New event, Team / My page / My events / More.
- **Fix:** put an "Add a page" row (`${ORG_PATHS.home}?add=1`) into S7's More brief as a pinned item, and list it in the S8 consistency matrix before R1 merges. Until then, keep it as a known gap in S1's handover. It is not a silent snapshot update.

---

## NOTE

- **N1. StaleLink has two Home controls.** `home/StaleLink.tsx:16` passes `back={{ to: home, label: 'Home' }}` and also renders the Home button. The test counts only `role=button` (the back is a link), so the brief's "one button Home" passes while the screen has two Home targets. Fix: drop the `back` prop, or accept the shell back as chrome and say so in the test.
- **N2. Two "New event" buttons on C1b, both with the same accessible name.** The first-steps row `create_first_event` and the gold button below it are both "New event" (see the snapshot). This is what the brief and S0b ask for (D36). It is flagged for the owner because a screen reader hears it twice.
- **N3. The localStorage key is not scoped to the login.** `switch/useOrganiserChoice.ts:6` is `'org-r1-chosen-page'`. On a shared phone, login B reads A's last page id. It falls back safely because the id is not in B's list, but the id outlives sign-out. Fix: key it `org-r1-chosen-page:<user.id>`.
- **N4. `today` comes from the device clock** (`useHomeData.ts`, `londonTodayKey()`), while `organiser_home_v1` returns its own `today`. Ruling on 3(c): `londonTodayKey` gives the correct London day across the 2026-10-25 clock change (output below). A phone with a wrong clock would still disagree with the server. Consider `home.data.today ?? londonTodayKey()`.
- **N5. Ruling on 3(a): `add_cover` -> `/page` is right.** S0b's `homeJobs.ts:82` emits it when the PAGE has no `avatar_url`, titled "Add a photo", and that photo is edited on My page. A page with no series has no event to cover, so the brief's `/cover/:seriesId` could not be built. No Home text promises a cover screen. Only the pinned `JobKind` name is misleading; leave it, since it is pinned.
- **N6. The `profile/` re-exports are the minimum needed.** `team/index.tsx:43-44` and `profile/index.tsx:35-36` still import the old paths, and the two one-line re-exports keep them building. `team/` now statically imports `switch/index.tsx`, which holds `SwitchPage` too, so the switch code also rides in the team chunk until S6/S7 repoint. `check:chunk-cycles`, `check:bundle-budget` and `check:first-load-requests` are all green.

Ruling on 3(d): the disabled New event shows its reason **on screen**, in a visible `<p>` tied to the button with `aria-describedby`. The text itself is wrong (B1).

---

## 1. Files touched

```
$ git diff --stat origin/feat/organiser-r1...origin/claude/org-r1-home
 25 files changed, 787 insertions(+), 1061 deletions(-)
 (docs/organiser-rebuild/handovers/S1.md, __tests__/draftOrganiser.matrix.test.tsx, home/{OrganiserStatusCard(D), StaleLink, homeView, index, useHomeData}.ts(x),
  home/__tests__/{HomeFixes(D), HomePage(D), home.matrix(D), HomeR1, StaleLink, noLabels}, profile/{OrganiserSwitcher, useOrganiserChoice} (re-exports),
  shell/OrganiserRoutes.tsx, shell/__tests__/routes.test.tsx, switch/{index.tsx, useOrganiserChoice.ts, __tests__/Switch.test.tsx},
  tests/e2e/organiser-{home,layout,loop,onboarding}.spec.ts, tests/regression/today/__snapshots__/account.today.test.tsx.snap)
```
- **Protected files:** none appear in the list. It has no `src/lib/account*`, `accountGate`, `src/pages/Account*`, `event-page/`, `vite.config.ts`, `calendar/`, `scripts/check-*`, `db-contract-check.yml`, `AnimatedRoutes.tsx`, journey specs, `useKeyboardInset`, `src/lib/keyboard*`, or the 4.11 read-only `shared/*` files. `home/onboarding/**` (S9) is untouched.
- **Outside the row:** each change is the minimum needed.
  - `OrganiserRoutes.tsx`: 2 import targets and 2 `name` props.
  - `routes.test.tsx`: 2 rows moved from the placeholder list to the real-screens list.
  - The e2e edits in layout, loop and onboarding are pure test-id swaps (`home-empty` / `home-strip-lineup` -> `home-jobs`).
  - The `draftOrganiser.matrix` edit is minimal, but it pins B1.
  - The snapshot diff: see S3.

## 2. Boards
- **C1:** page name h1; a 44px `Link` to `ORG_PATHS.switch` only with 2+ pages; an `<ol>` of `<button>` rows (56px) from `homeJobs()` in its order; gold New event -> `/new/what`; `SMALL_BUTTONS` Team, My page / My events, More (2x2 grid). There is no Tonight card, no `SectionLabel`/`StatusTag` (grep test), and no sentence apart from the disabled reason (B1). Matches 3.14/D36/D37/D38.
- **C1b:** the four first-steps rows from `homeJobs()`, gold New event, and the same four buttons. Support rows appear only on C1b, each one only when its env value is set (D7: More + first steps). Matches.
- **C35 Switch:** rows show name, role (Owner/Manager), and a Live chip only when `lifecycle_status === 'live'`. A tap remembers the choice and opens `Home?o=id`. Back goes Home. Matches. The author added "Add a page" here (see S3).
- **C34 StaleLink:** `STALE_DATE_TEXT` is computed from `dateLock()`, so it equals `eventState.ts:75` exactly ("This date has already happened, so it can no longer be changed."). It has one Home `<button>` (plus the shell back, N1) and is exported for S2/S3.

## 4. Consistency over the home shapes
`HomeR1.test.tsx` renders every S0b shape and uses `homeJobs()` as the oracle for each row's kind, n, title, sub and target:
- new page
- running page
- 1 series
- live with 0 coming dates
- draft 9 days
- draft 2 days
- no cover
- join request
- manager
- paused + ended only
- 45-series page with 40 archived

Home computes no fact of its own. Cancelled-only (`cancelled_upcoming_count > 0`, `upcoming_count 0`) has no S1 row, but it is a row in S0b's `jobs/__tests__/homeJobs.matrix.test.ts`, and Home only renders what `homeJobs` returns. So the same fact reads the same on Home.

The exceptions to "no copy pointing at a missing control" are B1 (Send for review / Profile page) and S3 (add a page unreachable). The empty states are OK: C1b has its 4 jobs, and error has Retry.

## 5. Mutation evidence
Baseline: `npx vitest run src/modules/organiser/home src/modules/organiser/switch src/modules/organiser/shell` gives `Test Files 12 passed (12)`, `Tests 122 passed (122)`. Each mutant was reverted with `git checkout -- <file>` straight after its run.

| # | Mutant | Result |
|---|---|---|
| a | `home/index.tsx`: `organisers.length > 1` -> `> 0` (Switch link with one page) | RED: `FAIL HomeR1.test.tsx > the page name and Switch > one page: the name shows, no Switch link` (1 failed / 53 passed) |
| b | `home/index.tsx`: `jobs.filter((_, i) => i !== 2).map(...)` (drop the 3rd row) | RED: 14 failed, e.g. `'1 live series with coming dates': each row reads Job.title ...`, `a running page: 1 Change, 2 Add, 3 Cancel ...`, `no series -> C1b: exactly four numbered rows ...` |
| c | `home/homeView.ts`: prepend `import { SectionLabel } from '../ui';` | RED: `FAIL noLabels.test.ts > D22 under home/ and switch/ > no SectionLabel or StatusTag import` `+ ".../home/homeView.ts"` |
| d | `home/StaleLink.tsx`: render `STALE_DATE_TEXT.replace("already happened", "passed")` | RED: `FAIL StaleLink.test.tsx > StaleLink (C34) > shows the eventState past-date text verbatim ...` (- Expected + Received) |
| e | `home/index.tsx`: non-problem rows, then problem rows `.reverse()` | RED: `FAIL HomeR1.test.tsx > ... > 45 series of which 40 archived -> 5 series rows (R3-4)` (1 failed / 51 passed) |
| f | `switch/useOrganiserChoice.ts`: `const wanted = remembered();` (ignore `?o=`) | RED: `FAIL HomeR1.test.tsx > the page name and Switch > 2+ pages: the name is a 44px link to Switch; ?o= picks the page shown` |
| g (extra) | `switch/index.tsx:38`: `rememberChoice(id);` -> `void id;` | **GREEN** `Tests 122 passed (122)`: see S2 |

## 6. Real-data shapes (prod `stsdtacfauprzrdebmzg`, one read-only aggregate, counts only, 2026-10-16 ~16:50 UTC)
The query read `event_series_p5` (non-template) with scheduled and cancelled `event_occurrence_p5` on or after London today, and `organiser_profiles.claimed_by`:

| Shape | Prod count | Matrix row |
|---|---|---|
| non-archived series | 93 | yes (all shapes) |
| live, 0 scheduled coming dates | 16 | yes (`live, 0 coming dates`) |
| live, cancelled-only coming dates | 1 | S0b `homeJobs.matrix` (no S1 row; see section 4) |
| live, no cover | 0 | yes (`live, no cover`) |
| drafts older than 7 days | 4 | yes (`draft 9 days old`) |
| paused / ended | 21 | yes (`paused + ended only`) |
| organisers with no non-archived series | 8 | yes (`no series (C1b)`) |
| max series on one page / max archived on one page | 45 / 45 | `45 of which 40 archived`. **The prod page has 45 archived (all of them)**, so it renders C1b. Covered by the `no series` row in effect (`isListedSeries` empties the list), but there is no explicit "45 archived, 0 listed" row: NOTE for S8. |
| owner logins / logins with 2+ pages | 3 / 0 | 2+ pages tested in unit (Switch); not met in prod (S1 latent) |
| non-live organiser pages | 0 | `draftOrganiser.matrix` (B1 latent) |

## 7. CI steps in the sandbox (slice head 620948f)

| Job | Command | Exit | Note |
|---|---|---|---|
| typecheck | `npm run check:rpc-typing` | 0 | |
| typecheck | `npm run check:wallclock-brand` | 0 | |
| (brief) | `npm run typecheck` | 1 | 96 `error TS` on head, **96 on base 9807a49** (same run in a base worktree); none in an S1 file. The only organiser one, `edit-in-place/__tests__/TeamPicker.test.tsx:297`, is on base |
| architecture-guard | `bash bin/check-integrity.sh` | 0 | |
| architecture-guard | `npm run check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 | |
| architecture-guard | `npm run lint:architecture` | 0 | |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| architecture-guard | `npm run check:mojibake` | 0 | |
| (brief) | `npm run lint` | 1 | 17 of 18 links green. The one red is `check:integrity` exit 126 (`bin/check-integrity.sh` is mode 644 in this checkout, while CI runs `chmod +x bin/*.sh` first; run with `bash` it exits 0) |
| perf-budget | `npm run build` | 0 | |
| perf-budget | `check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 / 0 | |
| unit-tests | `npm run test:unit` | 1 | 15 failed / 8564 passed, all in 4 files: `eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract` (live DB, sandbox) and `integrityCouldNotRun` (sandbox). **The same 4 files on base: `Tests 15 failed | 71 passed`**, so they are identical and none is organiser |
| e2e-smoke | `npx playwright test` the 9 organiser specs of `test:e2e` (dev server, fake backend) | 1 | 63 passed, 2 failed: `organiser-events.spec.ts:257` (`expect(page).toHaveURL` failed) and `organiser-loop.spec.ts:14` (`locator.click: Timeout 15000ms`). **Same two run on base 9807a49 in a base worktree: both fail with the identical errors**, so neither comes from S1 (S8 rewrites both) |
| types-drift | `npm run gen:types` | not run | needs the Supabase token; no types change in the slice |

## Verified / Not verified
- **Verified:**
  - the file list and that no protected file is touched
  - every board rule in brief section 2, read in code
  - all 6 brief mutants RED, plus 1 extra mutant GREEN (S2)
  - `londonTodayKey` at the BST end (`2026-10-24T23:00Z -> 2026-10-25`, `2026-10-25T23:59Z -> 2026-10-25`, `2026-10-26T00:00Z -> 2026-10-26`)
  - the prod shape aggregate (read-only, counts only)
  - the CI steps above, with the base comparisons for typecheck, unit and e2e
  - the snapshot diff, read line by line
- **Not verified:**
  - a browser walk at 390x844 on prod-shaped data (the E2E project `srrpvuxldthwumzrngla` was not seeded or walked by the reviewer)
  - a real phone
  - the Vercel preview (no token used)
  - `types-drift` (needs a Supabase token; no types change in the slice)
  - `/code-review` (the owner types it)
