## What changed

- A new **New event** flow inside `/account/p3/create` (`src/modules/organiser/p3/new/*`, lazy loaded). It replaces the R1 bridge.
  1. Pick the kind first: one date, weekly, monthly, workshop, class + party, or other dates. Course, festival and online show as disabled with "Coming soon".
  2. Pick the page, only for logins with 2+ pages.
  3. One form: name, venue search, cover, first date or extra dates, repeat rule, sessions, price, and how people pay.
  4. **Save draft** or **Go live**.
- Every write goes through `series_command_p5`, one step at a time, each with its own idempotency key and chained on the last `new_version`: cover, create (draft), repeat rule, extra dates, sessions, then optionally live. No database change.
- If a step fails after the create, the screen says what is "Not saved yet" and offers Try again (only the steps left), Open the draft, or Discard it. A landed create is never sent twice: not after a remount, a lost reply, a double tap or a reload.
- The old `new/what`, `new/name` and `new/:id/*` URLs redirect into the new flow or to the event page, keeping the format and page. Welcome's and Home/Events' "Add an event" now point at the new flow.
- Fix round 1:
  - **Red unit job.** The test read the URL in the same tick as the "partial" card. React Router 7 writes the location inside `startTransition`, so under CI load the card (an urgent update) can paint before the URL gains `sid=`. The test now waits for the URL. Production is safe in that gap: storage already holds the created draft, a reload there opens a blank form, the draft is listed under Events, and nothing is sent twice.
  - **Coverage.** A coverage line has been added to `BUILD-INVENTORY.md`.
- Inventory: `docs/design/p3-create-event/BUILD-INVENTORY.md`. Coverage: 71 rows, 30 built, 30 deferred (with reason), 11 excluded, 0 silent.

## Verified on real data

- Shapes surveyed: prod `stsdtacfauprzrdebmzg`, read-only counts on 2026-10-30, full table in BUILD-INVENTORY "Prod shape survey":
  - 758 series by format x status (105 non-archived).
  - 60 repeat rules: 51 weekly with one weekday, 6 monthly nth weekday, 1 day of month, 1 weekday-except-last, 1 custom.
  - Ends: none 45, after a count 11, until a date 3.
  - Pages per login: 14 have 1, 1 has 2+.
  - Sessions per series: 0, 1, 2, 3-5 and 6+.
  - Venue on 95 of 105, cover on 93 of 105.
  - `payment_methods` is set on 0 of 758, which is why Price asks for it.
  - 1 draft has no occurrence.
- Checks run: matrix tests over those shapes, red-first tests, local reproduction of the CI red, and a browser walk at 390x844:
  - Matrix tests, every kind x every shape above: `src/modules/organiser/p3/new/__tests__/`, including `review1.test.tsx` and `review2.test.tsx`.
  - Red first: every review finding has a test that failed on the code before its fix.
  - The CI red `review2` R2-2 test was reproduced locally under CPU load (1 of 3 runs failed: the URL had no `sid=` when the partial card showed). With the fix it passed 6 of 6 runs under the same load.
  - `npx vitest run src/modules/organiser` passes: 222 files, 8281 tests.
  - Browser walk at 390x844 with prod-shaped data. Screenshots are in `docs/design/p3-create-event/walk/`.
  - CI per job on 03b3024 (before this round):

    | Job | Result |
    |---|---|
    | unit (Europe/London, full) | failed: R2-2 only (fixed in this round) |
    | unit (Australia/Sydney, tz-sensitive) | passed |
    | unit (America/New_York, tz-sensitive) | passed |
    | e2e-smoke | passed |
    | phone-qa | passed |
    | build-smoke | passed |
    | integrity | passed |
    | bundle-budget | passed |
    | contract-check, live-db-gate | passed |
    | dancer-area-isolation, wallclock-brand, masking-check, bom-check, notification-check | passed |
    | phone-qa-section, real-data-verified | failed: PR body (this body fixes both) |
    | seo, og, lighthouse, synthetic, doc-weight | skipped by design |

- NOT verified: no real create was made (prod is read-only for workers), and the items below:
  - Creating an event on a real device or against prod: no write was made.
  - The fixes to the round-2 review findings have not been reviewed again.
  - The DEFERRED rows (18 slice-2 and 12 needing admin) are not built, by design.
  - The onboarding gate screen: the flag is off on prod.

## Phone QA

- Sizes checked: 390x844
- Walked: in a browser at 390x844, every kind (one date, weekly, monthly, workshop, class + party, other dates). For each: kind picker, blank form, venue search, venue not found, repeat sheet, sessions, price, review top and bottom, and the cancel sheet. Screenshots are in docs/design/p3-create-event/walk/.
- Not verified: a real phone (iOS safe-area, the on-screen keyboard over the sticky footer); the course, festival and online kinds (disabled, DEFERRED); 360x640.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01WoGkiBTk9egAFxDf5GwyPw
