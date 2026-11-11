# Review r2: PR #1439 (door refused card: Check again + Back to events)

grep: review-1439-r2

| PR | Head reviewed | Base (main) | Mergeable | Verdict |
|----|---------------|-------------|-----------|---------|
| #1439 | `8aa5b7ef04659789c3588823ab7e6a3cd6f64c8a` | `f0f3b291` (head already contains main) | clean | **PASS-with-fixes** |

One review round, read-only. Nothing was pushed to `claude/door-no-access-dead-end`.
Real diff vs main: `DoorScreen.tsx` +40/-5, `model.ts` one copy line, `door.css` one rule,
two new tests, three docs. Line endings are clean now: plain `--stat` equals `--ignore-cr-at-eol` `--stat`.

## 1. Findings from the r1 review (`docs/review/review-door-raffle-1439-1429.md`, #1439 section)

| r1 fix | Status at 8aa5b7ef | What catches it coming back |
|--------|--------------------|-----------------------------|
| 1. Offline Check again is silent | **Fixed.** `DoorScreen.tsx:141` reads `r.isError`, and `:146` also catches a throw. Both set "No signal, try again", shown as `role="alert"` (`:321-322`). | `door.noAccess.matrix.test.tsx:82` (`then_network` cell: the alert must say "No signal, try again"). Mutant M4 makes 2 tests fail. |
| 2. Mixed line endings / bare CR inside JSX | **Fixed.** The committed blob is all LF: 0 CR, 491 LF. The working tree has 491 CRLF and 0 bare CR, from `.gitattributes eol=crlf`. | **Nothing.** `check:integrity` (`bin/check-integrity.sh`) does not look for a bare `\r`, and `text=auto` does not normalise one. See finding B. |
| 3. Check again falsely clears a typed-code refusal | **Fixed as designed.** `DoorScreen.tsx:143`: when the refusal came from a check-in, the card stays and a note is shown. | `door.noAccess.matrix.test.tsx:77` (`typed` cell). Mutant M5 makes 2 tests fail. **But the new note's copy points at controls that are not on screen** (finding A). |

## 2. Findings (most severe first)

**A. Medium: the typed-refusal note points at controls that are not on screen.**
After a check-in refusal followed by an ok list read, the card says *"That code was refused when
it was checked. Scan or type it again."* (`DoorScreen.tsx:143`). The card stays, though, because
`notAllowed` (`:84`) is still true through `shown.kind === 'not_allowed'`, and both tabs
render only the refused card in that state (`ScanTab :230`, `ListTab :443`). I confirmed this with a
throwaway copy of the `typed` cell. After Check again, on both tabs, `door-code-input`
is ABSENT, `door-camera` is ABSENT, and the only buttons are `Scan | Tonight's list (3) | Check again`.
The worker cannot scan or type anything. Each tap of Check again shows the same note, and Back to
events is the only way out. This breaks the "no copy points at a missing control" rule.
*Fix:* in that branch, clear the check-in refusal (`setShown(null)`, reset `onScreen` and the gate)
so the scanner and code box come back, with a note such as "You can check tickets now. Scan or
type the code again." Or keep the card and change the copy so it names only Check again and Back to events.
*Test:* in the `typed` cell, after recheck, assert that `door-code-input` is present, or assert that the
note's text names no control missing from `screen.getAllByRole('button')`.

**B. Low: the r1 bare-CR fix has no guard.** A lone `\r` inside a source line is not caught by
`check:integrity`, `check:mojibake` or `.gitattributes`. *Fix:* add a small unit or guard check that
fails on `/\r(?!\n)/` in `src/**/*.{ts,tsx,css}`, or at least in `src/modules/organiser/p3/door/`.

**C. Low: mutant M9 survives (see the table).** Nobody tests `else onScreen.current = null;`
(`DoorScreen.tsx:144`). Clearing it does no harm, but no test shows that a code
already on screen can be scanned again after access comes back. Add one assertion, or remove
the line if it is not needed.

**D. Nit.** `DoorScreen.tsx:195` and `:200` (`recheck={recheck} ...` props) are indented with one
space. This is left over from the bare-CR repair. It is cosmetic.

**E. Nit.** `.p3-note` has `margin: 0`, so "No signal, try again" sits flush under the buttons
(walk screenshot). A `margin-top: 6px` would separate it.

## 3. UI checks on the refused card (390x844 walk)

I walked it with a throwaway Playwright spec (not committed) built on the repo's
`tests/e2e/walk-p3-batch-1-door.spec.ts` harness (`OrganiserFake`, route-mocked
`ticket_door_list_v1` returning `not_allowed`). It ran in dark and light, on both tabs, with
`VITE_ENABLE_ORGANISER_P3/TICKETING/SELF_SERVE=true`. Root `html` font-size measured 13.572px.

| Check | Dark | Light | Bar |
|-------|------|-------|-----|
| Check again (orange `--btn`, `--btnfg` text) | 162x56, 6.46:1 | 162x56, 6.46:1 | >= 44px, >= 4.5 |
| Back to events (line button) | 164x56, 12.33:1 | 164x56, 19.14:1 | same |
| Detail copy | 10.68:1 | 16.19:1 | 4.5 |
| Headline on grey band | 8.1:1 | 7.53:1 | 4.5 |
| "Checking&hellip;" disabled (`--mut` on `--card2`, computed) | 5.06:1 | 6.37:1 | 4.5 |
| "No signal, try again" note (14px) | 5.84:1 | 7.53:1 | 4.5 |
| Sideways scroll | 0px | 0px | 0 |
| Label clipped | no | no | no |

The sizes are explicit px (`.p3-door-big` sets `min-height: 56px`), so the 13.5px root-font trap does not apply.

States:
- **Loading:** a 2.5s delayed read shows "Checking&hellip;" with the button `disabled=true`, then it re-enables.
- **Offline:** an aborted request shows "No signal, try again".
- **Ok read:** the card clears.
- **Back to events:** lands on `/account/p3/events`, on both themes.

The camera-help and typed-refusal paths were not walked in the browser. Finding A comes from the jsdom test, not the walk.

## 4. CI at head 8aa5b7ef (42 check runs, via the GitHub PR check-runs read)

**Green:** bom-check-routed, bom-check, route, e2e-smoke, masking-check, notification-check,
wallclock-brand, no-preview-reason (x4), bundle-budget, integrity, unit (America/New_York),
unit (Australia/Sydney), unit (Europe/London, full), dancer-area-isolation, phone-qa (1), phone-qa (2),
phone-qa (3), build-smoke, decide, phone-qa-section, real-data-verified, live-db-gate, open-pr,
canary (x3).

**Skipped:** lighthouse, doc-weight, contract-check, og-check, og-preview, enable, synthetic,
synthetic-preview, seo-preview, seo-check, measure (x3).

**Red:** none, so there is nothing to compare against main.

## 5. Mutants

Each row is one edit to the PR head. I then ran `vitest run src/modules/organiser/p3/door tests/doorRefusedCardCentring.test.ts` (405 tests) and restored the file.

| # | Mutant | Result |
|---|--------|--------|
| M1 | Check again does not refetch (`r = { isError: false, data: list.data }`) | RED, 10 fail |
| M2 | Back to events links `/` instead of `P3_PATHS.events` | RED, 10 fail |
| M3 | Refused card hides both controls (`&& false`) | RED, 10 fail |
| M4 | Offline is silent (`if (r.isError) {}`) | RED, 2 fail |
| M5 | Typed refusal cleared by an ok list read | RED, 2 fail |
| M6 | Copy back to "open this screen again" (`model.ts`) | RED, 11 fail |
| M7 | Button not disabled while checking | RED, 2 fail |
| M8 | Check again also calls `checkInTicket` (a write) | RED, 10 fail |
| M9 | Ok read does not reset `onScreen` | **GREEN, survives** (finding C) |

## 6. Copy and entities

- The new detail ("then tap Check again") names a button that is on screen in every branch that renders the card.
- The typed-refusal note does not. See finding A.
- No raw Unicode punctuation: the non-ASCII byte count in all five touched source files is 0. `'Checking…'` is a JS escape, not a pasted character. `npm run check:mojibake` scanned 2664 files and found no corruption.

## Verified on real data
- Shapes surveyed: prod read-only counts: `tickets` 4, checked in 3, `ticket_night_check_ins` 0 (no live door traffic). The refused-card shapes come from the PR's matrix: list refusal, typed refusal, then ok, then network, zero sold, each on the scan and list tabs.
- Checks run: door vitest at the PR head, 405/405. 9 mutants, 8 red and 1 survivor. 390x844 Playwright walk in dark and light (sizes, contrast, sideways scroll, loading, offline, ok, Back route). `check:mojibake` clean. CI read from GitHub check runs.
- NOT verified: a live prod refused state (no door traffic in prod); a real-phone walk; the camera-help card with the merged recheck props; whether `ticket_door_list_v1` and the check-in RPCs authorise the same set of people (finding A assumes they can differ, as r1 did).
