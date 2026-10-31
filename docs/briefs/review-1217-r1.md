# Brief: independent review r1 of Website PR #1217 (p3 editor dead states, FIXLIST F-17/18/19/22/24/25)

Repo 123constante/bachata-website. Builder: Sonnet on `claude/p3-fix-editor-states` (head 1fce96e1c). You are the Opus reviewer: write ONLY `docs/review/pr-1217-r1.md` on branch `claude/review-1217-r1` (from origin/main). Never edit the builder branch. Context cap 35%.

Read first: `docs/design/p3-acceptance/FIXLIST.md` rows F-17, F-18, F-19, F-22, F-24, F-25 and the audit lines they cite (AUDIT-gate.md, AUDIT-public.md); `docs/briefs/p3-fix-editor-states.md` on `origin/brief/p3-fix-editor-states`; then `git diff origin/main...origin/claude/p3-fix-editor-states` (19 files).

Verdict per row: does the change close the row as the audit described it, on EVERY shape the row names (festival with 0 prices; venue list failure AND empty; cancel reasons empty; archived series on EventPage and on a deep link; tab bar and phone Back on a date field sheet; bad cover URL)? For each: PASS / FAIL / PARTIAL with file:line.

Cross-cutting checks (owner rules):
1. ONE shared mapping for every fact shown on more than one screen (status tag in status.ts used everywhere; no second "Finished" or "Removed" string; the venue list piece used by both sheets). Grep for duplicates.
2. No copy points at a control not on screen; every empty or error state is actionable; disabled controls say why.
3. Tests: table-driven over the shapes above? The builder admitted red-first was NOT done: run the new tests against the UNFIXED code yourself (check out the main versions of the changed source files, keep the tests) and report which tests go red. A test that stays green on unfixed code is a FINDING.
4. Files owned by #1208 untouched (sessions.ts, RepeatSheet.tsx, parts.tsx, screens.matrix.test.tsx, P3Routes, P3Shell, shell/paths, p3/new/**, you/surface.tsx, package.json).
5. `npm run check:bundle-budget` on main and on the branch: delta must be 0 bytes to the dancer-app first load. p3.css changed: no colour seam, tokens only.
6. The F-24 router blocker: does it fire on the tab bar AND on phone Back AND on the sheet's own close, and never block when nothing was typed? Prove with a test or state CANNOT-TELL.
7. Run `npm run lint`, `npm run test:unit` for the changed areas, `npx tsc --noEmit`.

Output: `docs/review/pr-1217-r1.md` with verdict PASS / PASS WITH NITS / BLOCK, findings numbered F1..Fn with severity, file:line and the exact fix, and a Not verified list. Commit subject `docs(review): PR #1217 editor-states r1 <VERDICT> [worker-done <ticket>]`, push once.
