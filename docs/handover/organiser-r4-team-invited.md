# Handover: organiser R4 slice (d), Team Invited rows

PR #1802, branch `feat/organiser-r4-team-invited`. Flag `organiserR4` (default off).

## Done
- `src/modules/organiser/p3/r4/r4InvitedModel.ts`: parse + model for `list_organiser_invites_sent_v1`.
- `src/modules/organiser/p3/r4/r4InvitedApi.ts`: untyped RPC call (types.ts not edited).
- `R4Team.tsx`: Invited section under Waiting to join; hidden when empty / not allowed; error with Try again.
- Tests: `__tests__/r4Invited.matrix.test.ts`; walk `tests/e2e/walk-r4-team-invited.spec.ts` (390x844, report only).
- tsc run on the PR head: 0 errors in branch files.

## Left / next
- No revoke: the repo has no revoke command for team or door invites. Add one only when the backend ships it.
- Not verified: a real signed-in owner/manager on prod; real door rows (0 on prod); real phone.
- `check:no-social-word` fails on main (unrelated test files); not touched here.
