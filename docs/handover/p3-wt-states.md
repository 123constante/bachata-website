# Handover: p3-wt-states (EDITOR-STATES + HOME-COPY)

Branch `claude/p3-wt-states`, brief `docs/briefs/p3-wt-states.md` (ticket dt_698e4b07c0a1).

## Done (code)
- F-06: "Complete your profile" on Details and Prices is a react-router `Link` (client navigation), testid `p3-profile-link`.
- F-16: `HomeScreen.noNextCopy` follows the state: a live recurring series with no dates says to open it in Events to add dates; live-but-all-finished says so; nothing names "Add an event" (no such button on Home).
- F-17: venue sheet on Details and the per-date "Where" sheet: error shows Try again (refetch); empty list says what to do (`L.detailsPlaceEmpty`).
- F-18: `L.pricesNoneFestival` (no "free" switch mentioned) shown when the free switch is not on screen.
- F-19: `ReasonPick` empty list shows message + Try again (Keep it already closes the sheet).
- F-22: archived reads "Removed" (`statusOf`, `L.removed`, hint "It was removed"), not "Finished". Remove navigates (replace) to Events with the words "Removed from your events." shown there (`p3-events-said`). Not-found card already says "may have been removed".
- F-24: `FieldSheet` (per-date name/photos/price) now uses the tray's router blocker (`useLeave`, exported from EditTray) so a tab-bar tap or phone Back asks before dropping; Stay resets the blocker.
- F-25: cover `onError` drops the image (no broken icon).
- F-34: "See it as dancers see it" link on a live event page (`/event/<slug or id>`, new tab).

## Tests
- New `p3/screens/__tests__/states.matrix.test.tsx` (10 tests). Updated `screens.matrix.test.tsx` (Home copy per state) and `eventPage.matrix.test.tsx` (archived chip = Removed).

## Left / next
- Router-blocker path of F-24 has no unit test (needs a data router); walk it at 390x844: edit a date name, tap a tab.
- Overlay e2e at 390x844 (sheet/confirm/toast inside viewport) not written.
- Shape survey (Supabase) and bundle-budget not run by this worker, see PR body.

Run so far: organiser vitest 221 files / 8421 tests green; eslint on p3 clean for touched files (1 pre-existing error in OnboardingFlow.tsx:112). check:bundle-budget needs a build, not run.
