# Review round 3 (delta only): S1a Website fix round 2 (PR #1523, `claude/ticket-night-aware-website`)

Reviewed head: `5d6adb23332ba459049a2920e9011611788c9ee1` (head 5d6adb23 of PR #1523) against `main`
(merge-base `4bebd94`). Delta reviewed: `git diff e015802a 5d6adb23` (10 files: four screenshots, the design
record, two handovers, `TicketsBlock.tsx`, `EventStickyActionBar.tsx`, `nightControls.matrix.test.tsx`).
Round-2 report: `docs/review/ticket-night-aware-website-r2.md` on `claude/review-ticket-night-aware-website-r2`
(FIX-4, N6, N7, N8; reviewed e015802a). Brief: `docs/briefs/review-ticket-night-aware-website-r3.md`
(sha 7c877d50). Reviewer: zero-context cloud worker, ticket dt_ed29ff8110f8, not the round-1/2 reviewer and
not the builder. No source edited; no prod read was needed this round (no new data claim in the delta).

## Verdict: PASS

The four round-2 items are fixed in the delta, each fix is covered by a test that fails under the matching
mutant, the vitest run the brief names is green, and the round-1/2 PASS items are untouched by the delta.
No new defect found by reading the delta. What is not verified is the real layout at 390x844 (jsdom only),
which the PR body and both handovers already say plainly.

## Checks, in the brief's order

### 1. FIX-4: the quiet-bar spacer is the LAST child of the block in every quiet state: PASS
- Reading `TicketsBlock.tsx` at 5d6adb23: the no-refusal `NightPicker` renders right after the ticket rows
  (`:316`, before the fixed quiet bar, which is out of flow); the refusal alert (`:341-357`) is followed by the
  refusal-case `NightPicker` (`:359`); the form (never present when `quiet` is set, since `quiet` means nothing
  buyable) and the "Pick a ticket" hint follow; the spacer `data-testid="ticket-bar-quiet-spacer"` is the final
  child of the `<section data-testid="tickets-block">` (`:594`), rendered iff `quiet`. The old spacer inside the
  quiet-bar fragment is gone (`:337`). So in no-night, sold-out, and refusal-plus-list states nothing in flow
  follows the spacer. Fixed as asked.
- Tests (`nightControls.matrix.test.tsx:316-355`, "FIX-4"): last child is the spacer for (a) weekly no-night
  with the list in document order before the spacer, (b) sold out, (c) a `night_ended` refusal followed by a
  sold-out re-read (alert, list and spacer all present, spacer last); (d) no spacer when buyable.
- Mutants, run in a worktree at 5d6adb23 with the repo's `node_modules`:

| Run | Result |
|---|---|
| baseline `npx vitest run src/modules/tickets src/modules/event-page` | 58 files, 1117/1117 pass (31.0s) |
| spacer back inside the quiet-bar fragment AND the no-refusal list back below the bar (the e015802a layout) | 2 fail: FIX-4 "weekly, no night on screen", FIX-4 "a refusal, then the re-read list is sold out" |
| only the spacer back inside the quiet-bar fragment (the 1a6bc4d layout: list above, refusal list below) | 1 fail: FIX-4 "a refusal, then the re-read list is sold out" |

  Both mutants are caught; the second shows the refusal case is tested on its own, which is the case round 1's
  commit 1a6bc4d had missed (the fix-2 handover says so honestly).

### 2. N6 honest; N7 mutant fails; N8 reworded: PASS
- N6: the PR body (fetched 2026-11-10 ~16:25 UTC) says in Fix round 2 and in "Verified on real data" that a
  `format='festival'` series renders `FestivalDetail`, which has no in-site ticketing surface before and after
  the PR, and that the festival test shape is a fixture for the components only; the screenshot caption and the
  "Not verified" line match. `docs/design/ticket-night-aware-website.md` gets a "Festival: NOT covered by this
  UI" paragraph, the "one festival (one night)" sentence now says its page is `FestivalDetail`, the empty-state
  line says "fixture only", and a "Fix round 2" section records all four items. The test-file header says the
  same. Consistent with round 2's reading of `EventPage.tsx` / `FestivalDetail.tsx`; no code change was asked
  or made for it.
- N7: test "N7: an applied promo preview does not follow a night change" applies SAVE10 on w0 (total shows
  GBP 9), rerenders on w2 by prop only, asserts no "applied. You save" note and the full GBP 10. Mutant:
  `const key = selected ? promoKey(selected.id, qty) : null;` (night dropped at `TicketsBlock.tsx:124`):
  1 fail, exactly that test; 25 pass. Round 2's gap is closed.
- N8: `EventStickyActionBar.tsx:225` fallback title is now "Tickets cannot be bought on this page"; grep for
  "event dates" over `src/` outside tests: zero hits. The branch stays dead (BentoPage always passes
  `onOpenTickets`), which is fine: its text no longer names a control that is not on screen.

### 3. No regression: PASS
- `npx vitest run src/modules/tickets src/modules/event-page` at 5d6adb23: 58 files, 1117/1117 pass (round 2
  had 1112; the 5 new tests are the FIX-4 x4 and N7 x1 above).
- `git diff --name-only e015802a 5d6adb23` has no `ticketCheckoutApi.ts`, `ticketCheckoutModel.ts` or `promo.ts`:
  the v2 reads, `buildCheckoutBody` (`occurrence_id` iff a night), the five refusal copies and `promoKey` are
  byte-identical to what rounds 1 and 2 passed.
- `npm run check:mojibake` at 5d6adb23: 2653 files, no cp1252 corruption. No raw Unicode punctuation in the
  delta (the test uses `£` escapes).
- `npx tsc --noEmit -p tsconfig.app.json` at 5d6adb23: 147 error lines in this sandbox, 0 of them in
  `TicketsBlock.tsx`, `EventStickyActionBar.tsx` or `nightControls.matrix.test.tsx`. The total is the
  pre-existing, machine-dependent set round 2 described (91 there, 147 here and in the fix-2 handover); the
  delta adds none.

### 4. Not verified
- No browser walk at 390x844 in this round: that the last night row is tappable above the fixed quiet bar, in
  the no-night state and after a refusal, is proven only structurally (DOM order in jsdom). The screenshots in
  the delta (`docs/handover/fix1-shots/`) are from round 1, before the spacer moved, and the PR body says so.
  This remains the lead's walk on the preview, as the fix-2 handover states.
- Contrast of the quiet bar and the night rows; the overlay remount on a real night change; real Stripe; the
  edge deploy and live 409s; iOS Safari.
- The one-night (festival) empty-state copy is fixture-only by the PR's own account; nothing on a real page
  reaches it today.

## PR #1523 checks at 5d6adb23 (GitHub API, 2026-11-10 ~16:25 UTC)
39 check runs, 0 failed. success (30): phone-qa (1,2,3), phone-qa-section x2, build-smoke, decide x2,
real-data-verified x2, unit x3 (Europe/London full, America/New_York, Australia/Sydney), dancer-area-isolation,
e2e-smoke, contract-check, live-db-gate, bom-check, bom-check-routed, route, masking-check,
notification-check, integrity, bundle-budget, wallclock-brand, no-preview-reason x4, open-pr. skipped (9):
enable, og-check, og-preview, lighthouse, doc-weight, synthetic, synthetic-preview, seo-check, seo-preview.
`mergeable_state`: clean.

## Notes (not blocking)
- N10 (nit): in the no-refusal no-night state the `NightPicker` now sits in DOM order BEFORE the fixed quiet bar
  while in the refusal state it sits after it. Visually irrelevant (the bar is `position: fixed`), and a screen
  reader meets the list before the bar either way only in the first case. Harmless; a single render site after
  the refusal block, guarded by `showNights`, would be one line simpler.
- Round-1 N3, N4, N5 and round-2 N9 stand as written; round-1 handover follow-ups (typed form lost on a night
  change; only 8 nights listed) stand.

## Verified / Not verified
- Verified: the whole delta read file by file; FIX-4 placement traced to lines; vitest baseline and three
  mutants (two FIX-4 layouts, one N7) at 5d6adb23; tsc at 5d6adb23 filtered to the delta files; mojibake check;
  N8 grep; PR body and design record wording for N6; all 39 PR check runs.
- Not verified: see section 4.
