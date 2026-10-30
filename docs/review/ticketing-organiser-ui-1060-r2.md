# Review round 2: PR #1060, S3b organiser ticketing (design B), the critique fixes

Branch `claude/ticketing-organiser-ui` at head `5dd9e40` (fix commit `e5a895d` on top of the critiqued
`939903a`). Judged against the round-1 critique `docs/review/ticketing-organiser-ui-1060.md` (PR #1067)
and the owner's definition of done. Read-only: nothing on the PR branch was edited.

**Verdict: PASS with should-fix.** The blocking finding and the three should-fixes are fixed in code
and each is pinned by a test that goes red when the fix is reverted. The fixes introduce no blocking
defect. One should-fix remains: the thousands-separator fix reached Home but not the event page, the
review step or the capacity error, so the same count now reads two ways across screens.

## How it was checked
- Read every file the fix commit touched and the whole module at `5dd9e40` (model, wire, four
  screens, parts, routes, flag and catchall diffs, all five test files, the handover and journey docs).
- Ran the ticketing suite plus `focusReturn` in a worktree at `5dd9e40`: 1,170 pass (6 files).
- Mutation: reverted each fix one at a time and re-ran `compact.model`, `screens.matrix` and
  `ticketModel.matrix` (table below). Two extra probes for gaps.
- A throwaway test (not committed) proving the count-format split (finding N1).
- eslint on `src/modules/organiser/tickets`: 0 errors, 6 pre-existing warnings. `tsc -p tsconfig.app.json`:
  113 errors, none in the module (same count the handover reports for main). No raw non-ASCII in the
  fix diff. `git merge-tree` against current `origin/main` (`0f52b65`): clean.
- PR #1060 on GitHub: `mergeable_state: clean`; the latest check runs on `5dd9e40` are green
  (`decide`, `real-data-verified`, `phone-qa-section` at 08:43Z; `contract-check`, `integrity`,
  `build-smoke`, `unit (Australia/Sydney)`, `wallclock-brand`, `dancer-area-isolation` at 07:29Z;
  preview-only jobs skipped on a `claude/` branch).
- Looked at the author's 390x844 shots `11`, `14`, `15`, `16`.
- Nothing was run against prod. Supabase was not needed (prod still has 0 ticket rows per the PR body).

## Per-finding table

| # | Round-1 finding | State | Where (at `5dd9e40`) | Test that goes red when reverted |
|---|---|---|---|---|
| 1 | BLOCKING: "Paid out via Stripe" chip removed the profile switcher | **Fixed** | `TicketsHome.tsx:38-42` passes no `topBarEnd`; chip now in `tix-page-line` at `TicketsHome.tsx:127-130` | `screens.matrix` "Home keeps the profile switcher (stripe connected)" (1 red) |
| 2 | Event card "left of" counted draft and paused places | **Fixed** | `ticketModel.ts:479-485` filters to `on_sale` / `sold_out`, null when none; `parts.tsx:282` shows the chip alone on null | `compact.model` "event state and places left" (5 red, incl. the critic's mixed shape) |
| 3 | No thousands separators | **Fixed on Home, split elsewhere (N1)** | `ticketModel.ts:157-160` `formatPence` / `formatCount`; used at `parts.tsx:203-216` and in `eventLeftLine` | `compact.model` separator table + "left of 3,000" (7 red); `screens.matrix` big-numbers test |
| 4 | No way to Connect / Finish connecting once the Next step card moves on | **Fixed** | `ticketModel.ts:535-542` `paymentsLink`; `parts.tsx:64-86` `useStartOnboarding` shared; `parts.tsx:230-254` `PaymentsLink`; rendered `TicketsHome.tsx:96` | `compact.model` role x Stripe x mix (4 red) + `screens.matrix` click tests (2 red) |
| S1 | Smaller: an edit always opened at step 1, four taps to raise places | **Fixed** | `TypeSheet.tsx:164-179` Save changes (primary) + Continue (ghost) on steps 1-2 of an edit; a new ticket keeps Continue only | `screens.matrix` "Save changes from step 1 / 2" (2 red); "no Save before the review" guards the new-ticket side |
| S2 | Smaller: `aria-describedby` named an id not rendered for the role reason | **Fixed** | `SeriesTickets.tsx:281` passes `reasonId` only when `shownReason` renders | `screens.matrix` "names only a reason that is on screen: contributor" (1 red) |
| C1-C3 | Coverage gaps the critique listed (Close sales confirm, back-from-Stripe notes, orders empty words) | **Covered** | `screens.matrix.test.tsx` 517-536, 505-512, 514-521 | n/a (new tests) |

Mutation run, all at `5dd9e40`, 1,150 tests in the three files: M1 1 red, M2 5 red, M3 7 red, M4 6 red,
M5 2 red, M6 1 red. Probes M7 and M8 stayed green (see Test gaps).

## New findings

### N1. Should-fix: the same count reads two ways across screens
The fix added `formatCount` and applied it to Sold, the rarer counts, and the event card's "N left of M",
but not to the other places the same facts are shown:

- `SeriesTickets.tsx:277` `countsLine` (the ticket row): `ticketModel.ts:444` builds `${sold} sold &middot; ${left} left` from raw numbers.
- `ticketModel.ts:598` `reviewRows` Places: `f.capacity.trim()` as typed.
- `ticketModel.ts:288` the capacity error: `${ctx.reserved} tickets are already taken`.
- `soldLine` / `takenLine` (`ticketModel.ts:200-202`) have no importer any more; dead exports.

**Failing scenario** (the critique's own 3,000-place shape, which the author's shot `16` uses): Home
reads "978 left of 3,000"; tap the event and the row reads "2022 sold &middot; 978 left"; open the edit sheet to
the review and Places reads "3000"; lower Places below the 2,022 taken and the error reads "2022 tickets
are already taken". One fact, two formats, on the two screens one tap apart. The owner's doctrine
("one shared mapping for any fact shown on more than one screen") is the rule this breaks, and
`screens.matrix.test.tsx:209` currently pins the unformatted form, so the split is tested in.

Fix: `countsLine` and the capacity error go through `formatCount`; `reviewRows` Places formats
`Number(f.capacity)`; delete `soldLine` / `takenLine`; update the matrix expectation at line 209 to
build from `formatCount`. Four lines of code, no new test shape needed beyond the existing big-numbers one
extended to the event page.

### N2. Test gaps (not defects; the code is right, nothing holds it)
- **Save from step 1 with a step-2 error.** `TypeSheet.tsx:105` jumps to the step that owns the error
  so the person sees it. Removing that line (probe M7) leaves all 1,150 tests green. Scenario worth a
  test: edit, Continue to step 2, clear Places, Back, change the name, Save changes; expect `tix-step` "2 / 3"
  and the capacity error visible.
- **Payments link double tap.** `parts.tsx:243` disables the link while `busy`. Removing the guard
  (probe M8) leaves every test green. One test: resolve `startOnboarding` late, click twice, expect one call.
- **Payments link with no live event.** `nextStep` returns null when `live` is empty, so the link renders
  above "No live events yet" for stripe `none` / `started`. That is consistent with the round-1 fix 4 wording
  and arguably useful (Stripe can be set up before an event is live), but no test says so either way; the
  "no live events" test only asserts the Next step card is absent.

### N3. Notes, no action required for this PR
- On steps 1 and 2 of an edit, the primary button is now Save changes and Continue is a ghost; an
  untouched tap on the primary closes the sheet with "Nothing changed, so nothing was saved." That
  honours "an untouched save sends nothing" but is a one-tap exit from a sheet the person may have
  opened to look at step 2. Watch for it on the owner's phone test; if it bites, swap the emphasis on step 1 only.
- A contributor sees no payment state on Home unless Stripe is connected (no card, no link, no chip for
  `started`). The round-1 critique accepted this; noting it because the S3 screens showed the state to every member.
- Shot `15`: the datetime-local field renders "11/06/2026, 08:00 PM" in the headless browser's US locale; that
  is the browser's native control, not the app, and will read as the phone's locale on device.
- Fee and refund copy ("50p booking fee per paid ticket", "booking fee included") match the documented
  contract (journey doc Q9, Q5). The edge functions are still assumed, as every round has said.

## Checks against the brief's list
| Area | Result |
|---|---|
| Money display (pence to pounds, commas, free vs paid, 50p fee) | `formatPence` / `priceLabel` / `feeLabel` / `buyerTotal` are the one path; "Free" for 0, "50p" under a pound, commas from `toLocaleString('en-GB')`. OK apart from N1 (counts, not money) |
| Refund sheet (full vs partial, who may refund) | Whole order only (`refundAmount` = total minus already refunded); button shown only for owner / manager on a `paid` order with money left (`refundable`); confirm names buyer and amount; contributor sees the tag and one reason line. OK |
| Stale cache after save | `refresh()` invalidates the `['org-tickets']` prefix after every write and refund (`SeriesTickets.tsx:122`, 206, 218); Home re-reads the Stripe row on `?stripe=return|refresh`. OK |
| Disabled controls carry a reason | Add bar, the switch, Put on sale, the price field, the whole sheet when locked: each has a visible reason or the one page-top reason, and `aria-describedby` now resolves (S2). OK |
| Empty states say what the person can do | No page, no live events, no tickets (manager and blocked variants), no orders (selling / not selling): all name the next action. OK |
| Copy pointing at a control not on screen | "Tap Add a ticket below" is shown only when Add is enabled (`SeriesTickets.tsx:149`); "Switch a ticket to Selling above" only when a switch exists. OK |
| Flag off = zero visible change | One route inside `flags.organiserTicketing && flags.organiserSelfServe`; no import of the module elsewhere; no link into `/account/tickets` anywhere; `flagOff.test.ts` pins all three. OK |
| Route guards (owner / manager only) | `AuthGuard` on the chunk; a foreign `?o=` falls back to a member page and a foreign `seriesId` shows "not on this page"; every write and refund is behind `canManage` and the server checks again. OK |
| Double submit | Every primary action uses `PrimaryButton` / `GhostButton`, which disable while `loading`; the switch and the payments link disable on `busy`. OK (M8 is the only unguarded-by-test one) |
| Table-driven across every screen x shape | Home and One event x 12 shapes, add sheet x 7 manager shapes x paid/free, refund x 5 shapes, plus the role x Stripe x mix tables for the Next step and the payments link. Yes; and the fixes are red-first (mutation table above) |

## Verified / Not verified (this review)
Verified: everything under "How it was checked" above, on a worktree at `5dd9e40` with the repo's own
`node_modules`.

Not verified: no browser walk of my own (the author's shots `11`-`16` and the DOM audit in the PR body are the
record for geometry, safe area and tap sizes); 360x640 for the critique-fix states; the two-button edit footer
with the keyboard open on a real phone; real Stripe, real refunds, real RLS logins; the full `test:unit`,
`npm run lint` chain and phone-qa runs (CI on the head is green, which I take as the record).
