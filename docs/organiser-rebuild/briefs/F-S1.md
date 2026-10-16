# Fix brief F-S1 -- one fix pass on slice S1 (Home + Switch) after the independent review

Repo `123constante/bachata-website`, branch `claude/org-r1-home` (EXISTS, head `620948ff`; you are the ONLY worker on it), base `feat/organiser-r1`. You are the author's fix worker, not a reviewer. Plain git only (no `gh api`); write shell commands without variables, loops or `$(...)`; check a PRODUCTION build (`npm run build`). READ FIRST: `00-COMMON.md` next to this file with `<X>` = F-S1, `S1-home.md`, and `docs/organiser-rebuild/handovers/S1.md` on your branch. The full review is quoted below (also: `git fetch origin claude/org-r1-review-S1` then `git show FETCH_HEAD:docs/organiser-rebuild/reviews/REVIEW-S1.md`).

## The failure the reviewer found (owner's words: copy that points at a control that is not there)
On a non-live page, Home shows `newEventBlock` copy that says "Send it for review first" / "Profile page". Neither control is on Home any more, and the edited matrix test pins that copy.

## Do (files: `home/homeView.ts`, `home/index.tsx`, `home/StaleLink.tsx`, `home/useHomeData.ts`, `switch/*`, their tests, `__tests__/draftOrganiser.matrix.test.tsx` line ~138, `docs/organiser-rebuild/handovers/S1.md`)
1. **B1.** `newEventBlock` returns ONE R1 Home line for every non-live status naming no review step and no Profile page, e.g. `${name} is not live, so it cannot take events. Ask the Bachata Calendar team.` The matrix test asserts that text and `not.toMatch(/review|Profile/i)`. RED first against the old code, paste the failing output.
2. **S1.** In `useOrganiserChoice`, call `rememberChoice(selected.id)` whenever `?o=` resolves to a member page (never a non-member). Test: mount Home at `?o=B`, then a bare `ORG_PATHS.team` (or change) and assert the page shown is B. RED first.
3. **S2.** Add the Switch test: tap row 2, then mount bare `ORG_PATHS.home`, assert `home-page-name` is row 2's name. Then re-run mutant g (`rememberChoice(id)` -> `void id;`) and show it RED.
4. **S3.** Do NOT build "Add a page" on Home. List it in `handovers/S1.md` as a known gap (a one-page login cannot reach page creation from any control until S7's More row); the orchestrator pins it in the S7 brief.
5. **N1.** Drop the `back` prop from `StaleLink` (one Home target) and assert that. **N3.** Scope the localStorage key to the login: `org-r1-chosen-page:<user.id>`; test two logins on one browser do not read each other's key. **N4.** Use `home.data.today ?? londonTodayKey()` if `organiser_home_v1` returns `today` (check the type; if it does not, leave as is and say so). N2/N5/N6: no change.
6. Do NOT touch anything else, no protected file.

## Tests and CI (shown, not claimed)
Run `npx vitest run src/modules/organiser/home src/modules/organiser/switch src/modules/organiser/shell`, `npm run build`, `npm run check:mojibake`, `npm run lint:architecture`, `npm run lint` (`check:integrity` exit 126 is environmental). Per-job table with exit codes in the handover. Mutation: each new test must go red against a reverted fix. GitHub Actions refused with a payments annotation is not a code failure (the worker table is the fallback).

## Output
ONE push of `claude/org-r1-home` at the end (no WIP pushes; Vercel deploy cap). Last commit subject ends `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at 25% context; a continuation worker is normal and reads `handovers/S1.md`). Report head SHA and a Verified / Not verified.

## The review, verbatim
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

