# S-ERR handover -- two new server refusals mapped (PR #809)

## What changed
- `src/modules/organiser/shared/selfServeErrors.ts`: new `INVITE_REQUIRED_COPY`, `TEAM_FULL_COPY` (number from `TEAM_CAP`); `COPY` gets `organiser_invite_required` (`next: 'contact_support'`, one new `SelfServeNextStep` member) and `team_full`; `TEAM_COPY` gets `team_full` (add-member / set-member go through `teamErrorMessage`, so they now show it).
- `src/modules/organiser/flows/newpage/NewPageFlow.tsx`: refusal kind `invite` -> `InviteRequired`: copy, WhatsApp row and/or Email row from `supportLinks()`, plain "not available here yet" line when neither is configured (never a dead link), Back to Home. NO "Try again".
- `next` consumers: `NewPageFlow` (handles it), `OrganiserSheet` and `PublicClaimCard` (equality checks only, they never receive this code: claim/request do not raise it; the value falls through to message-only).
- Tests: `selfServe.test.ts`, `teamModel.test.ts`, `NewPageFlow.test.tsx`, `Team.test.tsx`.

## Redeem screen -- NOT edited (outside the organiser module)
`src/modules/admin-organisers/inviteModel.ts:173` `REDEEM_COPY` (reason lookup at :204-206). Unmapped `team_full` falls to `REDEEM_FALLBACK`. Proposed entry (needs the `RedeemCopy` fields; `TEAM_FULL_COPY` is exported from `selfServeErrors.ts`):
`team_full: { title: 'This team is full', body: TEAM_FULL_COPY, action: 'home', terminal: true },`

## Red first
Before the implementation: 9 failed / 89 passed across the four specs (selfServe x5, teamModel x1, NewPageFlow x2, Team x1). After: all `src/modules/organiser` pass (112 files, 3531 tests).

## Mutations
| Mutant | Result |
|---|---|
| remove `organiser_invite_required` from COPY | 5 tests red |
| drop the WhatsApp row from the screen | 1 test red |
| remove `team_full` from TEAM_COPY | 3 tests red |

## Checks (local sandbox)
| Command | Exit |
|---|---|
| `npm run typecheck` | 98 TS errors, under the 106 baseline in pre-ship.mjs |
| `npx vitest run src/modules/organiser` | 0 |
| `npm run build` | 0 |
| `npm run test:unit` | 1: 15 failures in tests/eventViewCompat, integrityCouldNotRun, occurrenceProgram, publicEventPageLineup contract tests -- the same 15 fail with my changes stashed (not mine) |
| `npm run lint` | 1: only `check:integrity` exit 126 (sandbox cannot run it); eslint skipped because of it; 19 other links pass |
Other workflow jobs (Supabase contract checks, e2e, check:og) need live DB or a deploy: not run.

## Verified / Not verified
Verified: copy, the support rows, the absence of retry, the team_full add refusal, in jsdom; production build.
Not verified: the 390x844 real-browser walk and screenshots (not done in this run), the redeem screen, a real phone, `pre-ship`, `check:integrity`.
