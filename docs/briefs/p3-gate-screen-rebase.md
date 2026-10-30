# Brief: p3-gate-screen continuation, merge main and resolve conflicts (PR #1205)

Branch `claude/p3-gate-screen` (PR #1205, DIRTY: "merge conflict between base and head"). Original brief `brief/p3-gate-screen:docs/briefs/p3-gate-screen.md`, handover `docs/handover/p3-gate-screen.md` on the branch. The original worker finished its build; this job is ONLY to bring the branch onto current main and prove it still works.

Main has moved: Website #1202 (P3 shell exits, touches `P3Shell.tsx`, `p3/shell/paths.ts`, `p3/you/surface.tsx`, `P3Routes.tsx`, `flows/new/NewFlow.tsx`) and #1200 (grace banner CSS in `p3/theme/p3.css`) merged since the branch was cut.

## Do
1. `git fetch origin main` then merge `origin/main` into the branch (a merge, not a rebase; no force push). Resolve every conflict by keeping BOTH sides' intent: the gate sheet routing from this branch AND the #1202 exits and #1200 CSS. Never drop a main-side change to make a conflict go away. List each conflicted file and what you kept in the handover.
2. Where #1202 added the Cover "Go live with profile questions left goes to P3 Review (`p3StartReview`)" and this branch routes onboarding refusals through the A1 gate sheet, check the two do not double-handle the same refusal; state which one wins and why, and add one table row to `gate.matrix.test.tsx` if the interplay is not already covered.
3. Run: `npx vitest run src/modules/organiser` (all green), `npm run build`, `npm run check:bundle-budget` (adds 0 bytes to dancer-app), `npm run lint:architecture`, `npm run check:onboarding-write-doors`, and the gate spec `tests/e2e/p3-gate-sheet.spec.ts` with `VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true`. Kill any leftover dev server before stopping.
4. Push ONCE (final commit subject ends `[worker-done <ticket>]`, no `[skip preview]`). Then put a real PR body on #1205: `node ~/.claude/bin/pr-body.mjs` is not available in the cloud, so edit the body with plain git-free means only if the PR tool is available; otherwise write the body text into the handover and say so.

Stopping rule: one push, no new features, no redesign of the sheet. If a conflict cannot be resolved without changing behaviour, stop and report it in the handover with both versions.
