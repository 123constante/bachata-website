# Brief: independent review r1 of Website PR #1208 (P3 create-event slice 1, new save logic)

Repo 123constante/bachata-website. Builder: Opus on `claude/p3-create-event-build` (head bb1d86738, main merged in). You are the reviewer: write ONLY `docs/review/pr-1208-r1.md` on branch `claude/review-1208-r1` (from origin/main). Never edit the builder branch. Context cap 35%.

Read first: `docs/briefs/p3-create-event-build.md` (origin/brief/p3-create-event-build) and the BUILD-INVENTORY the builder wrote on its branch (`docs/design/p3-create/**` or as named in the PR body); the two earlier in-branch review rounds (commits "review round 1" and "review round 2" on the branch) so you do not repeat them; then `git diff origin/main...origin/claude/p3-create-event-build`.

Focus (new logic = permissions, save paths, data integrity):
1. Save path: `p3/new/useCreateSave.ts` and `model.ts`. Single in-flight save, idempotency key reuse on retry, readback checks the id, created draft never hijacks a new one after remount, version refetch, "retry keeps Go live". Try to break each with a test (double tap, reply lost, remount mid-save, stale version). A behaviour the existing tests do not pin is a FINDING.
2. Cover upload before create (FIXLIST F-15): a refused create leaves a stray file. State whether that is in this PR's scope or correctly deferred, and what the user sees.
3. Gate interplay (A-gate-10): the refusal shows its own card instead of the shared "A few details first" sheet. Confirm or refute with file:line.
4. BUILD-INVENTORY coverage: every row built / deferred / excluded with a reason; count them; any row silently missing is a FINDING.
5. Routes: `?kind=weekly&at=form` deep links, old URLs keep format and page, `P3Routes.exits.test.tsx`. No sideways scroll at 390, sheet geometry test present.
6. `npm run check:bundle-budget` main vs branch (0 bytes to dancer-app first load); `npm run lint`; `npx tsc --noEmit`; unit tests for the changed areas. Note the Coming-soon pill fix (round 2) at 360/390/430.
Output: `docs/review/pr-1208-r1.md`: verdict PASS / PASS WITH NITS / BLOCK, findings F1..Fn (severity, file:line, exact fix), Not verified. Commit subject `docs(review): PR #1208 create-event r1 <VERDICT> [worker-done <ticket>]`, push once.
