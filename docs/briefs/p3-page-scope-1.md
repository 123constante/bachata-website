# Brief: P3 page scope (F-26): Home, Events and Stats show the chosen page, and say which

Lane: normal. Suggested model: Opus (a data scope rule across three screens). One worker, branch `claude/p3-page-scope-1` (family `claude/p3-*` is claimed). Push ONCE when coherent; never add `run-ci`; one independent review round (file-score rule), one fix round.
Source: `docs/design/p3-acceptance/FIXLIST.md` row F-26 (A-team-2, J-e4.1), checked against main at 8c60541c6 (FLIP-READINESS: STILL OPEN, no commit since). Owner goal: 10 real organisers claim a page and edit an event themselves; day-one impact is small (prod has 0 users with 2+ pages) but this unlocks every multi-page walk.
Decision (logged by the program lead 2026-10-31 00:30Z, "F-26 a"; the owner may overturn it): Home shows ONLY the chosen page. Skipped rows: none in this brief; F-27 (All dates) is already FIXED on main and is not touched.

## Files owned by this brief (the gate-retry brief `p3-gate-retry-1` must not touch them)
`p3/data/home.ts`, `p3/data/stats.ts`, `p3/switch/useOrganiserChoice.ts` and the page-switch screen, the Home, Events and Stats screens and their models. NOT touched: `graceModel.ts`, `gateModel.ts`, `OnboardingFlow.tsx`, `joinCopy.ts`, the join and redeem screens (another worker, dt_9589cd720c9b, is editing them), `EditTray.tsx` and `profileProgress.ts` (the gate-retry brief), the calendar protected files, `supabase/**`, anything in the admin repo, `claude/w3c-1-repeat`. `useOrganiserChoice` is also read by `GraceBanner` and `CreateFlow`: keep its contract, add, do not break.

## Step 0 (before any code): INVENTORY.md
Write `docs/design/p3-page-scope-1/INVENTORY.md`: every screen and string that shows pages, events, dates, going counts or stats for an organiser, in the admin app (what an admin sees per page), the current Website (P3 and the old organiser area), and the public organiser page, file:line each. Start from: `p3/data/home.ts:121-133` (`rowsOf` loops every page), `p3/data/stats.ts:63` (no page id), `p3/switch/useOrganiserChoice.ts:8`, the "Switch page: Showing X" line, and every reader of `OrganiserHome.organisers`. Search the sentences, not only the names. End with a coverage count: N rows found, N covered by a change or a "left as is" reason, none silently omitted.

## Prove the data source first (read-only; Supabase SELECT only, never a write)
1. Which RPC feeds Home and Stats; does it already accept a page id, or return all pages in one answer? Quote the function body or a counts-only call. If Stats needs a server parameter that does not exist, STOP that part and report (admin change, out of scope); do the client-side filter only if the answer already carries the page id per row.
2. Shapes, counts only: people by number of pages run (0, 1, 2, 3+), pages by events and by series with EMPTY `organiser_ids` (the client falls back to the caller's own pages), events run by 2+ pages, people who are admin.

## What to change (acceptance in words)
- Home, Events and Stats show the data of the chosen page only, and every one of them names that page at the top ("Ritmo Bachata London") with a "Switch page" control when the person has 2 or more pages. One page: no switch control, the name still shown.
- A person with 2+ pages and no choice yet lands on a deterministic default (the last used, else the first by name) and sees that page name; never a mixed list.
- An event run by 2+ pages appears under each of its pages, once per page, and says so ("Also run by X").
- Stats gets the same page choice as Home: one page's numbers, with the page name. If the server cannot give per-page numbers (proof 1), say so on screen plainly and show the page name on what is shown; do not present all-pages totals as one page.
- Switching page keeps the person on the same screen (Home stays Home), with no flash of the other page's data.
- Out of scope: any admin or database change, All dates, the gate, the join flow.

## Acceptance contract (every person type x every journey x every data shape, walked at 390x844)
Person types (P): P1 organiser with 1 page; P2 organiser with 2 pages; P3 organiser with 3+ pages; P4 admin viewing as an organiser; P5 manager (not owner) of one page and owner of another; P6 contributor; P7 organiser with 0 live events; P8 organiser whose chosen page was just removed or left.
Journeys (J): J1 open Home; J2 open Events; J3 open Stats; J4 switch page from each of the three; J5 deep link to an event of the non-chosen page; J6 first visit (no stored choice); J7 reload after choosing.
Data shapes (S): page with 0 / 1 / 100+ events; event run by 2 pages; series with empty `organiser_ids`; page name very long; chosen page id no longer in the list; slow or failed read (Try again, never a blank).
Rule: ONE table-driven vitest, each row (P, J, S) -> the exact page name shown, the rows shown (counts) and the switch control state. Every cell is covered or listed "cannot happen" with a reason. No screen may show events of a page other than the one named. Every empty state says what the person can do; a control that cannot work is disabled with a reason. Red first: run the new rows against the unfixed code and show them failing.
Then walk the cells that differ visually at 390x844 with route-mocked answers in the cloud sandbox like `walk-fix-join-dead-ends` (dev-server Chromium, reduced motion, wait for the heading text); the harness `tests/e2e/walk-invite-recheck.spec.ts` on `claude/walk-invite-recheck-1` fails any state showing the error card; reuse its waits. OPEN every picture yourself; a green test is not a pass. State the coverage count P x J x S: N covered, N "cannot happen".
An independent reviewer (a different worker) checks the pictures against this contract BEFORE the orchestrator walk; the owner's phone check is last.

## Standing rules (Website)
Prove the data source first. Zero bytes to the `/app` first load (`npm run check:bundle-budget` on main and branch); never edit `perf-budgets.json` or `vite.config.ts`. HTML entities over raw Unicode punctuation; full weekday names; British English. Source files over 2 KB go through `scripts/safe-edit.py`. Overlay geometry: sheets must not scroll the page. PR body: run `pr-body.mjs` the moment the PR exists (label `- Shapes surveyed:`, Phone QA names 390x844). Report Verified / Not verified, honestly.
