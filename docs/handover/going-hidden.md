# Going / Interested hidden from visitors (ticket dt_16cc3eec408a)

Owner decision 2026-10-18: hide the check-in control completely until it can do something visible.

## Switch
`GOING_CHECKIN_ENABLED` in `src/lib/goingCheckin.ts` (now `false`). Turn back on: set it to `true` once
(1) dancers are shown ("who is going"), (2) the profile lock is enforced server-side, (3) the "Going next" opt-in exists.
Nothing else to change. No DB writes, RPCs, tables or hooks were touched or deleted.

## Surfaces found (file: what a visitor saw) and what off does
- `modules/event-page/bento/blocks/RsvpBlock.tsx` (+ mounted in `BentoPage.tsx`): "I'm Going" / "Interested" buttons, count line, lock line, sign-in prompt. Off: renders null, no RPC runs, BentoPage does not mount it.
- `RsvpBlockPlaceholder.tsx`: disabled lookalike while the lazy chunk loads. Off: null (no layout gap).
- `pages/FestivalHub.tsx`: per-card Going/Interested counts, "N attending", attendee avatars, WhatsApp progress, the two buttons, and the page-level lock line. Off: all hidden (festival cards keep name/date/crew chips/details link).
- Dancer app Home (`HomeScreen.tsx`): "Upcoming nights / Nights you said Going to" tile. Off: hidden. `NumbersTiles.tsx`: Going and Interested strip cells and the "say you are going" hint. Off: only "Nights been to" / "Levels rated" cells; strip card hidden if those are zero.
- `NightsScreen.tsx` empty state ("Tap I'm Going or Interested...") and `pages/MyAttendance.tsx` empty state: how-to sentence hidden (it points at a control that is gone). The lists of already-saved nights stay.
- `PublicDancerPageV2.tsx`: "Going next" section hidden.
- Not rendered anywhere (dead, left as is): `components/EventAttendanceButtons.tsx`, `AttendeesModal.tsx`, `modules/event-page/sections/EventAttendanceSection.tsx`.
- Not changed: `DancerDashboard.tsx` / `Dancers.tsx` / `DancerProfile.tsx` read-only "Going: n . Interested: n" summaries of a dancer's own existing rows (account area, not a tap target; outside the brief's list). Flag for owner if wanted.

## Tests
`src/lib/__tests__/goingHidden.test.tsx`: table over RsvpBlock, placeholder, FestivalHub, numbers strip (+ all-zero), MyAttendance empty: off => nothing Going-related and no attendance RPC; on => renders as before. Red-first: 7 of 13 fail on the unfixed code, all pass fixed.
Existing specs that assume Going is visible now mock the flag to `true` (one line each).

## Verified / Not verified
Verified: `vitest run src` 254 files / 6496 tests pass; `tests/client` + `tests/regression` 35 files / 1158 pass; build; check:legacy-tables, check:legacy-program-rpcs, lint:architecture, check:rpc-typing, check:wallclock-brand, check:mojibake all exit 0.
Not verified: browser walk at 390x844, prod-shape survey (read-only SELECT not run), Actions on GitHub, remaining `tests/*.contract.test.ts` and `integrityCouldNotRun` (fail identically on unmodified main here: need network/tooling), `tsc` errors in BentoPage/FestivalHub/Venues are pre-existing (same lines untouched).

## Isolation fix (dancer-area-isolation, run 39104714650)
Before (`npm run check:dancer-area-isolation`, base origin/main 0a9d2d4): 4 violations, all rule (a): `src/lib/__tests__/goingHidden.test.tsx`, `src/lib/goingCheckin.ts`, `src/pages/MyAttendance.tsx`, `src/pages/__tests__/MyAttendance.test.tsx`.
Fix (owner/orchestrator decision): both specs `git mv`'d to `tests/client/goingHidden.test.tsx` and `tests/client/myAttendance.test.tsx` (imports fixed); `src/lib/goingCheckin.ts` and `src/pages/MyAttendance.tsx` added to `seams` + `seamNotes` in `scripts/dancer-area-isolation-allowlist.json`. The check script is untouched. `briefs/dancer-rebuild-INTERFACE.md` lives on another branch and is untouched: the orchestrator mirrors the two seams there.
Deviation: `src/pages/__tests__/MyAttendance.test.tsx` already exists on main, so moving it counts as a change to that path; it is a third seam (with note) in the allow-list. The orchestrator mirrors all three seams into the INTERFACE doc.
