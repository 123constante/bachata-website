# Walk: PR #1307 (F-26 page scope) at 390x844

Walked code: `claude/p3-page-scope-1` @ 7099e7e. Spec: `tests/e2e/walk-page-scope-1-pr1307.spec.ts` (16 tests, all ran; mocked answers at the network boundary, no prod access). Flags: `VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true`. Text and sweep data per picture: `texts.jsonl`. Every one of the 23 pictures was opened and looked at.

Mock people: 1 page (Ritmo Bachata London: Friday Bachata, Sunday Party, Shared Social), 2 pages (+ Zouk and Sway: Tuesday Practica; Shared Social run by both), 3 pages (+ Alpha Dance Co: Monday Footwork; Shared Social run by all three), no page, admin flag (is_admin=true, 3 pages). Stats mock returns one row per series for the whole team, as the real RPC does, so the client filter is what is under test. Views are fake: 100 x series position.

## FAILs (report first)
1. **FAIL (minor, copy): no-page person, Events and Stats.** `0p-events`: "No events here yet. Events this page runs show up here" and `0p-stats`: "0 views, this page's events / You have no events to count yet" talk about "this page" when no page exists and no page name or Switch is on screen. Home sends this person to onboarding (`0p-home` is fine), but a direct visit to /events or /stats shows page-words with no page. Not an error card.
2. **NIT / CANNOT-TELL: Switch page list has no visible "current page" marker** (`2p-events-switch-open`, `3p-events-switch-open`). The chosen page is only in the heading above the list and `aria-current`; the open list shows all names the same. Two rows can look like a choice between equals with nothing ticked.
3. **First run of `admin3-home` showed an "Application Error: Cannot read properties of null (reading 'useContext')"** (Vite dev dep re-optimisation on a cold server, thrown in `app/root.tsx`). It did not reproduce on rerun (picture below is the clean rerun). Treated as a dev-server cold-start flake, not a PR defect, but recorded because an error card is a FAIL by the rules.

## Pictures (one line each; sweep: taps <44px only in the site-wide header/footer links the PR does not own; no sideways scroll; no garbled punctuation, apostrophes and middle dots render correctly)
| Picture | Verdict | What I saw |
|---|---|---|
| 1p-home-p3 | PASS | Page name "Ritmo Bachata London", no Switch (1 page). Next up Friday Bachata, Needs you lists the 3 events, tile "600 views of this page's events". Picture is cut at 844px (list below is DOM-only, see note). |
| 1p-events-events | PASS | Name, 3 rows, no Switch, no "Also run by" (nothing shared). |
| 1p-stats-stats | PASS | Name, tile 600 "views, this page's events", chart, By event: 3 series (300/200/100). |
| 2p-home-p3 | PASS | Defaults to Ritmo (first by name), Switch page link visible and tappable. |
| 2p-events-events | PASS | 3 own events; Shared Social says "Also run by Zouk and Sway"; Tuesday Practica (other page) not shown. |
| 2p-events-switch-open | PASS (see nit 2) | List of both pages opens in place under the name, events stay below. |
| 2p-events-after-switch | PASS | URL stays /events (?o=...), now "Zouk and Sway": Shared Social (Also run by Ritmo) + Tuesday Practica; Friday/Sunday gone. |
| 2p-stats-stats | PASS | Ritmo: 600, By event Shared/Sunday/Friday, Tuesday Practica absent. |
| 2p-stats-after-switch | PASS | Switched on Stats stayed on Stats: Zouk and Sway 700 = 400 + 300; By event Tuesday Practica, Shared Social. |
| 2p-home-after-switch | PASS | Home keeps the choice: Zouk and Sway, tile 700, Needs you "Shared Social, Tuesday Practica". |
| 2p-events-stale-choice | PASS | Remembered page id that no longer exists: falls back to Ritmo (by name), no error. |
| 3p-home-p3 | PASS | Defaults to Alpha Dance Co (first by name), 800, Needs you "Shared Social, Monday Footwork". |
| 3p-events-events | PASS | "Also run by Ritmo Bachata London, Zouk and Sway" (sorted by name, wraps cleanly). |
| 3p-events-switch-open | PASS (see nit 2) | Three pages listed, rows comfortably tappable. |
| 3p-events-after-switch | PASS | Zouk and Sway, "Also run by Alpha Dance Co, Ritmo Bachata London" (names the other two, not itself). |
| 3p-stats-stats | PASS | Alpha: 800 = Monday Footwork 500 + Shared Social 300. |
| 3p-stats-after-switch | PASS | Zouk and Sway 700, two events. |
| 3p-home-after-switch | PASS | Zouk and Sway, 700, correct Needs you. |
| 0p-home | PASS | Redirects to onboarding "Welcome / Find your page", not an error, not blank. |
| 0p-events | FAIL (minor, copy) | Empty state with "Add an event", but wording says "this page" (FAIL 1). |
| 0p-stats | FAIL (minor, copy) | "0 views, this page's events", "No views yet" (FAIL 1). |
| admin3-home | PASS (clean rerun) | Same as the 3-page person: one page, name, Switch page. |
| admin3-stats | PASS | Alpha Dance Co 800, as the 3-page person. |

## Verified / Not verified
Verified: Home, Events, Stats show only the chosen page and name it; Switch page changes the page in place on Events and Stats and Home keeps it; "Also run by" on shared events for 2 and 3 pages; by-name default; stale remembered choice; no-page person; view totals equal the sum of the chosen page's series.
Not verified / BLOCKED:
- **Admin app** (what an admin sees per page) is not mockable honestly; `admin3-*` only proves the `is_admin` flag does not change this screen.
- Home pictures end at 844px (the page scrolls inside a container, so my full-height resize did not apply): the lower "All your events" rows are confirmed from the DOM text in `texts.jsonl` (including "Also run by"), not by eye. CANNOT-TELL by eye.
- Series with empty `organiser_ids` (572 in prod) and the real Stats RPC were not exercised; fake data only. Mocked views are not real numbers.
- Tickets sold tile and Going tile (INVENTORY rows 15-16) are flag-off and were not walked.
- Chart shows only 5 bars because the mock gives 5 days of data.
- A phone tap-through on a real device was not done.
