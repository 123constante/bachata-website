# Handover: fix-gate-lost-edit

Branch `claude/fix-gate-lost-edit` (from main 833a32a). Brief: `brief/fix-gate-lost-edit:docs/briefs/fix-gate-lost-edit.md`.

## Done
- **Return path (item 2), every refused screen.** `returnTo.ts`: `finishLabel(back)` is "Back to your event"
  whenever the checklist has a valid event (left or not); "Go to Home" only with no valid event.
  `backAsSecondary` adds a second "Back to your event" button under Go live / Try again / Sign in again while
  things are left. `OnboardingFlow.tsx` ReviewScreen draws it (`p3-ob-back-event`, `.p3-ob-btn p3-ob-btn-line`: 52px, and 46px
  in the review foot on phones (page.css `.p3-ob-foot .p3-ob-btn-line`), explicit px, >= 44px). `finish()` goes back whenever there is a valid event.
- **Keep the edit (item 3), Repeat sheet.** New `onboarding/keptDraft.ts`: sessionStorage key
  `p3-kept-edit:<seriesId>`, 60 minutes, validated on read, never sent anywhere. `RepeatSheet` keeps the draft
  when the gate holds Save or the server refuses it; drops it on a working Save or a hand Close. `EventPage`
  reads it once on mount, reopens Repeat pre-filled with "We kept your changes", drops the stored copy; the
  person taps Save again (nothing replayed).
- Tests: `pageScreens.matrix.test.tsx` "fix-gate-lost-edit" block (5 counts x 5 screens x back valid/invalid x
  page live/draft = 100 cells; 50 red on main) and the updated slice R cells; new
  `screens/__tests__/keptEdit.matrix.test.tsx` (18; 3 red on main). `gate.fixround.test.tsx` now clears
  sessionStorage between tests (a refused Save in one test reopened its kept edit in the next).
- Only the checklist's Back (navigation state `KEPT_BACK_STATE`) reopens a kept edit; any other arrival leaves
  it alone (no uninvited pop-up), and it expires with the tab / after 60 minutes. Range-checked on read.
- Walk: `docs/walk/fix-gate-lost-edit/` (RESULTS.md + pictures), spec `tests/e2e/walk-fix-gate-lost-edit.spec.ts`.

## Not done (by design, say so in the PR)
- Details / Prices / Dates drafts are NOT kept: each is a multi-field editor with its own tray / sheet state
  (EditTray, PricesScreen, DateSheet), not one plain draft object, so not cheap. Their refusal still gets the
  Back to your event path (item 2).
- No real phone, no real server refusal (walk mocks it).

## Code review (1 round, medium; stopping rule was 2 rounds for user-facing, round 2 NOT run: context cap)
Fixed: stale kept edit popping up uninvited (arrival flag), page reused across events (tagged by id), kept
line when nothing to save, range checks, dropped cast, px claim. Not fixed: page-step exits inside the
onboarding flow still go Home (outside the checklist, out of this brief); an event no longer editable when
the person returns opens the read-only Repeat sheet (kept copy dropped); `left` param on finishLabel kept
for call-site stability.

## Next steps
- Keep-the-edit for Details / Prices / Dates as a follow-up, one screen per PR, reusing `keptDraft.ts`
  (widen `KeptScreen`).
