# Session handover 2026-10-27: P3 W2d sessions and line-up

Branch `claude/p3-w2d-sessions-lineup`, PR #1068 (bot-opened, body updated). Flag `organiserP3` stays OFF.

## Done
- Model `p3/model/programme.ts` (ONE rule set), data `p3/data/sessions.ts`, sheets `p3/screens/SessionSheet.tsx` (session sheet + scope picker + removeall + `DateSessions` rows for the date sheet) and `LineupSheet.tsx`, wiring in `EventPage.tsx` (Sessions rows open the sheet, Add a session, festival "Ask us") and one insert in `DateSheet.tsx`. Labels appended to `L`. 2 COMMAND_COPY rows.
- Tests: `model/__tests__/programme.matrix.test.ts` (153), `data/__tests__/sessions.data.test.ts` (84), `screens/__tests__/sessions.send.test.tsx` (11). P3 suite 973 green.
- Prod survey (read-only), walk at 390x844 light+dark, CI job steps: see `docs/design/1068.md`.

## Open
- `/code-review` (two rounds, user-facing): not run (owner types it).
- PR checks on GitHub: not read at hand-off (the final push triggers them).

## Next
- Owner: run `/code-review` on PR #1068; read the CI checks; keep the flag OFF until W3.
- After merge: W3 (save model) per ARC-p3; "From X on" (Q1) as a W2d-2 slice after the read-only reader check.

## Review round 1 (2026-10-27, brief `docs/briefs/p3-w2d-review-fixes.md`)
- Done: findings 1-8 all fixed with red-first tests; table and checks in `docs/design/1068.md` "Review round 1". Idempotency handler read on prod (key looked up by actor+key only, stored on success only).
- Left: the owner's `/code-review` rounds; PR checks on the final head; real-phone test. Flag stays OFF.
- Next: owner reviews r1 fixes (round 2 if wanted), then merge; W3 after.
