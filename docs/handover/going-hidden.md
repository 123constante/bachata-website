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

## build-smoke fix (dt_f672c211cf54)

**Cause.** Not this branch and not the chunk pin. A typed-code SIGN-UP recorded `accept_terms_v1` twice: `Auth.tsx` `handleCodeVerified` records, then navigates to `/auth/callback?mode=signup`, and `AuthCallback.tsx` records again (that second call exists for the e-mailed-link path). The server is idempotent, but the build-smoke spec expected exactly one. The spec polled `toBe(1)` and passed only when a poll landed between the two calls, so it was timing luck: green on #821, red twice on slow CI.

**Evidence.** On this head the spec passed 24/24 locally (poll samples early). With the poll replaced by "wait 3 s, then count" the SAME unfixed build reports `["accept_terms_v1","accept_terms_v1"]` (red, deterministic). The auth code is identical on `origin/main` (branch = main + 6 commits, none touch Auth/AuthCallback), so main has the same latent race. I did not bisect the six commits: the cause is in code none of them touch. The `4b47ae8` pin is not implicated.

**Fix.** `Auth.tsx` sets a sessionStorage mark after a record that landed; `AuthCallback.tsx` reads and clears it and skips its own record. A failed record leaves no mark, so the callback retries (unchanged behaviour). The marker is inline in the two pages: a first attempt exporting helpers from `termsConsent.ts` added one first-load chunk on `/auth/callback` and `/app/*` and tripped the chunk ratchet, so it was dropped. Spec: after the poll it now also waits for the hand-over and 2.5 s, then asserts still exactly one record (red on the unfixed build, green on the fixed one).

**Results (sandbox, exit codes).** production build against the fake Supabase: 0. `tests/e2e-build` full suite: 66 passed, exit 0 (this spec 3/3). `check:bundle-budget`: exit 0 (unfixed head 0; the helper-export variant FAILED, chunk allowance +1 on two pages). `check:dancer-area-isolation`: OK. vitest chunkClassifier + `src/pages/__tests__` + termsConsent: 545 passed. `tsc --noEmit`: 0.

**Not verified.** The GitHub `build-smoke` job itself (runs after the push); full `pre-ship`; a real-Supabase sign-up (fake backend only); the other 5 commits individually.
