# Handover: B1b S1 Going lock (`claude/dancer-app-r1b-lock`)

Brief: `briefs/dancer-rebuild-b1b-s1-lock.md` (sha a171613). Base: `origin/main` c36fbaf. No PR (slice branch; the orchestrator merges).
Ticket: dt_3816cc1a9222.

## What changed (files)

| File | Change |
|---|---|
| `src/modules/dancer-app/gate/useGoingLock.ts` (new) | `useGoingLock(): { locked, reason, href }` + the pure mapping `goingLockFor(facts)`, `goingTapLocked(lock, current, target)`, `missingFromGate(gate)`, `goingLockReason(missing)`, `GOING_LOCK_LINK_LABEL`. Reads `useAuth` (user, already loaded), `useDancerArea()`, `ProfileGateContext`, `useLocation` only: no request of its own. |
| `src/modules/event-page/bento/blocks/RsvpBlock.tsx` | Imports the hook INSIDE the lazy chunk. Closed-night reason still wins. When locked: a button that would set a NEW status is disabled (ghost style); the meta line shows `<reason>. ` + a `<Link>` "Finish your profile" (inline, `py-[14px]` widens the tap area without growing the line). |
| `src/pages/FestivalHub.tsx` | Same hook. Locked: the set-a-new-status button is disabled, a `festival-going-lock` line with the same reason + link sits under the buttons (link stops the card's click-through). `handleStatus` also refuses a locked tap. |
| `src/modules/event-page/bento/blocks/RsvpBlockPlaceholder.tsx` | Comment only: the placeholder box is the block's box for the open AND the locked state (the lock adds no box). |
| `tests/client/rsvpBlock.test.tsx` | useAuth mock keeps the real `ProfileGateContext` (importOriginal); client mock gets `auth: {}` so the gate read runs; gate answer = closed by default; NEW mirror-drift case: locked block shape == placeholder shape, and the exact meta text. |
| `tests/regression/today/eventRsvp.today.test.tsx`, `festivalHub.today.test.tsx` | Each answers `dancer_area_gate_v1` with `{open:false, allowed:false}` and the client mock gets `auth: {}`, so the today snapshots now run through the REAL not-allowed gate (before this they would only have run through the gate-error path). One outdated comment ("RsvpBlock does not read ProfileGateContext at all") reworded. **No snapshot changed** (`__snapshots__` untouched, all pass). |
| `src/modules/dancer-app/gate/__tests__/goingLock.test.tsx` (new) | The table-driven matrix (below). |

Nothing under `api/`, `screens/`, `shell/` changed (`shell/routes.ts` is only imported by the test).

## Decisions and INTERFACE deviations

1. **Where the missing step comes from.** `ProfileGateValue` (hooks/useAuth) does not expose the `missing` list, only `gateFor(returnTo).reason`, built by `lib/profileCompletion` `completenessFact`. To stay on "ProfileGateContext ONLY" without editing `useAuth.tsx`/`profileCompletion.ts` (not allowed files), `missingFromGate` finds which of the 15 possible missing lists produces that exact reason through the same `completenessFact` (inverts the one mapping; never parses words). A test round-trips all 15 lists. If the reason matches none: general words "Finish your profile to say you're going". Cleaner follow-up (needs an owner OK, touches `useAuth.tsx` + `profileCompletion.ts`): add `missing` to `ProfileGateValue`.
2. **Words.** Next missing step = first missing of first_name, city, role, photo (nextStep `REQUIRED_STEPS` order), its label from `api/nextStep.ts` `NEXT_STEP`. One step left: "Add your photo to say you're going". More: "Add your first name and a few details to say you're going". Link: "Finish your profile".
3. **href = `appWelcomeHref(here)`** (lib/accountRouting) = `/app/welcome?returnTo=<this page>`, so onboarding ends with a button back to the event / festivals page. The path part is identical on both surfaces; `returnTo` is each surface's own page (the test pins that).
4. **Organiser-type** = `hasOrganiserIntent(user.user_metadata.user_type)` (lib/accountRouting, the same reading as the profile switcher): it needs no request. Account.tsx's organiser check needs two RPCs, which the brief rules out.
5. **Not locked**: signed out, anonymous, gate loading/error, not allowed, organiser-type, `no_profile`, gate value loading/null/error/complete. Only `allowed && status === 'incomplete'` locks.
6. **Old RSVP**: a locked person can tap the button that is ON (removes it); the other button stays disabled. Unknown status while loading = both disabled (only when locked).
7. Locked event block replaces the "N going" count with the reason (as a closed night already does).

## Shapes surveyed (prod `stsdtacfauprzrdebmzg`, read-only SELECT, counts only, 2026-10-17)

- `dancer_area_open` flag: **true**; `dancer_area_access`: 1 row. So the lock is LIVE for every signed-in person with an incomplete profile once merged.
- auth users: 22 (non-anonymous breakdown below). Organiser-type (`user_type` not dancer): 6.
- Signed-in people by next step: complete 9 (+5 organiser-type complete); first_name with 4 missing 2; role with 1 missing 1; role with 2 missing (role+photo) 2; organiser-type role+photo 1 (stays unlocked, decision 4); no dancer profile 2 (stays unlocked).
- All 167 dancer profiles: complete 22; next step first_name (1/2/3/4 missing) 1/13/8/27; city (2/3 missing) 2/33; role (1/2 missing) 62/4; photo-only 0.
- Existing RSVPs (`event_attendance`, all P5): incomplete profile going 2, interested 1 (the "old RSVP still shows and can be removed" shape is real); complete interested 1; organiser-type complete going 1.
Every one of these shapes is a row in the matrix.

## Tests (table-driven)

`goingLock.test.tsx`: 18 person states (signed out, anonymous, not in area, allowed+complete, no profile, profile check loading / unpublished / failed, gate loading, gate failed, organiser-type, missing first name / city / role / photo only, missing all four, city+role+photo, role+photo) x 2 surfaces (event block, festival hub) -> observed `{locked, reason, href, goingDisabled, interestedDisabled}` must equal the expected row; plus the hook mapping per row (the same expected value, one mapping); old Going removable on both surfaces (sends `null`, Interested locked); `/app/welcome` is in `DANCER_APP_PATHS` and `CATCHALL_CLIENT_PATHS`; the locked block shows the link it names; all 15 missing lists round-trip.

## Red-first proof

`goingLock.test.tsx` run with `RsvpBlock.tsx` and `FestivalHub.tsx` reverted to `origin/main`: **35 failed | 24 passed (59)**, every failure `expected false to be true // Object.is equality` / `expected { locked: false, reason: null, ...} to deeply equal { locked: true, ... }` (the locked rows on both surfaces and the old-RSVP cases). With the fix: 59/59 pass.

## Bundle report (perf-budget.yml env: `npm run build` + `npm run check:bundle-budget`)

| Route | main c36fbaf | this branch | |
|---|---|---|---|
| event `/event/:id` | 377.8 KB / 47 files | 377.9 KB / 47 files | **+0.1 KB, owner rule <= 0.5 KB holds**, chunks unchanged |
| auth (catchall) | 293.3 KB / 33 | 293.4 KB / 34 | **chunk ratchet OVER (34 vs 33), puller ratchet OVER (3 vs 2)** |
| dancer-app `/app/*` | 362.9 KB / 57 | 363.3 KB / 59 | **KB OVER (363.3 vs 363), chunk ratchet OVER (59 vs 57), puller OVER (4 vs 3)** |

Cause (asset diff): rollup cut three new shared chunks, `useDancerArea`, `nextStep`, `useGoingLock`: the gate hook was inside the catchall chunk and `nextStep` inside the dancer-app chunk, and now the lazy RsvpBlock chunk and the festivals route import them too. Two pins were measured and REJECTED (not committed): adding the four modules to `lib-account` (event 380.7 KB, +2.9 KB; classes over budget) and a new `lib-dancer-gate` group (event 381.1 KB over budget; parties/classes over). `vite.chunks.ts` and `perf-budgets.json` are outside this slice's allowed files, so **perf-budget is RED and needs an orchestrator/owner decision**: either raise the auth (33->34 chunks, 2->3 pullers) and dancer-app (363->364 KB, 57->59 chunks, 3->4 pullers) allowances with this measurement, or a chunking fix in the integration branch.

## CI per-job table

CI_TABLE_PLACEHOLDER

## 390x844 walk

NOT RUN in the sandbox: `/event/:id` and `/festivals` are SSR/prerendered routes that 500 with the placeholder Supabase key the sandbox build uses (playwright.config.ts says so), and the sandbox cannot sign in to prod. Walk script for the orchestrator (Vercel preview of the integration branch, phone 390x844):
1. Signed out: open any live event page -> "I'm Going" + "Interested" + "N going", exactly as today. Open `/festivals` -> unchanged.
2. Sign in as a test account NOT on the dancer list while the flag is closed (or any account if you can't close it) -> unchanged.
3. Sign in as a beta dancer with no photo (incomplete): event page -> both buttons grey, line "Add your photo to say you're going. Finish your profile"; tap a button -> nothing is sent; tap "Finish your profile" -> `/app/welcome`; finish -> the end button says "Continue" and returns to the event.
4. Same account with an RSVP made earlier: the "You're Going" button stays active; tap it -> the RSVP is removed; "Interested" stays grey.
5. `/festivals` with the same account -> same line and link under each festival's buttons; the link opens `/app/welcome`, not the festival.
6. A complete profile -> no line, buttons work. An organiser-type account -> unchanged.
7. Check the link's tap area (~44px tall) and that the RSVP box does not jump when the lazy block lands.

## Verified / Not verified

Verified: unit + today-regression suites (see CI table); red-first; bundle numbers above; prod shapes (counts).
NOT verified: real browser walk at 390x844 (script above); real sign-in against prod; `/code-review` round (needs the owner to type it); perf-budget green (needs the decision above).

## What is left

1. Orchestrator/owner: the perf-budget decision above (allowances or chunk pins), then re-run `npm run check:bundle-budget`.
2. Optional cleanup with an owner OK: expose `missing` on `ProfileGateValue` and drop `missingFromGate`'s inversion.
3. The 390x844 walk on a preview.
