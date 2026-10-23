# Session handover 2026-10-23: W3 (invite names the person + duplicates repair)

Branch `claude/invite-w3-names-person`, PR #981. Ticket dt_b2b85c439f90.
Brief: `brief/invite-journey:briefs/invite-journey/W3.md`.

## Done
- "Who is this for?" (`InvitePersonWho.tsx`). The page's one Leader is pre-selected; the screen also lists
  the team, offers search and "Someone new". A named person is invited via `admin_invite_person_v1`. The row
  cannot close while the one-time link is shown.
- Refusal screens (`refusalScreen` in `invitePersonModel.ts`): `email_in_use` before and after A2, and
  `login_has_signed_in`.
- Duplicates (`duplicates/*`): an admin-home alert, then Same person?, What will change (dry run), a second
  confirm and Joined. Every screen shows "available soon" while A2's RPCs are missing.
- Tests: `__tests__/inviteWho.matrix.test.tsx`, `duplicates/__tests__/duplicates.matrix.test.tsx`, and a guard
  test in `routes.matrix.test.tsx`. Production-build walk: `tests/e2e-build/invite-who-duplicates.build.spec.ts`.
- Design record and 15 screenshots at 390x844: `docs/design/w3-invite-names-person*`.
- `/code-review high` ran; all 10 of its findings are fixed. Every CI job's steps were run locally (table in the PR body).

## Open
- On the second run, the real-data-verified and phone-qa-section checks failed against the old PR body. The body
  was rewritten, and both scripts pass locally against the new text. Confirm that their re-run is green.
- A2 has not pushed yet. W3 proposed these names: the dismiss RPC `admin_dismiss_duplicate_pair_v1`, the row
  shape of `check_invitee_duplicates_v1`, and the refusal codes. Align them with A2's PR (one string each in
  `duplicates/duplicatesApi.ts` and the copy maps).
- Not verified: a walk on a Vercel preview with real data and a real invite; the new screens at 360x640.

## Next
1. Check the CI on PR #981. If real-data-verified or phone-qa-section is still red, read
   `scripts/check-pr-*.mjs`: each label needs a colon with inline text after it.
2. When A2 pushes, compare its answers with `parseDuplicates` / `parseDryRun` and the refusal codes.
3. After the owner applies A2, the orchestrator walks the preview at 390x844 with a fresh invite (stages 5-6).
