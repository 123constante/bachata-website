# join-gaps-2 handover
Done: items 5 to 8 in code (see INVENTORY.md), table test `join/__tests__/joinGaps2.matrix.test.ts` (red on old code: doneBody missing, old request text), 4 existing tests updated for the new words. vitest on admin-organisers, lib, components, p3: 213 files green; tsc clean.
Left: browser walk at 390x844 (not done), independent review, `npm run pre-ship`, bundle budget check, PR body (`pr-body.mjs`). Item 7 passes no rows-left from JoinPage yet (null = details-first sentence); wiring the real count is a follow-up. Item 6 label still names the inviter although the team receives the request: lead decision.
Verified: unit tests, tsc, data proofs. Not verified: walk, pre-ship, CI, P x J x S pictures.

## Continuation (2026-11-04)
Done: item 7 wired (JoinPage reads organiser_onboarding_status_v1 on the Done step via the shared key, graceStatusFrom/onboardingLeft, passes rowsLeft; doneBody = 0 -> "yours", else details-first + graceModel.timePromise, unknown = details-first + "You can stop and come back."). Item 6 label now "Ask the team for a new one" (request_new_invite_v1 notifies no inviter); result copy unchanged. Item 5 unchanged. Walk: docs/walk/join-gaps-2/RESULTS.md (9 pictures, all opened). Gates: lint 24/24, vitest admin-organisers+p3+lib 174 files green, check:integrity ok, bundle budget identical to main (0 bytes /app).
Not done: independent /code-review, pre-ship, CI status, flag-OFF Done walk.
