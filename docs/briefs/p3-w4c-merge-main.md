# Brief: merge main into claude/p3-w4c-going-mount (PR #1206), keep both sides

PR #1206 is DIRTY: origin/main moved (#1202 shell exits merged) and `src/modules/organiser/p3/screens/HomeScreen.tsx` conflicts (checked with git merge-tree: that is the ONLY conflicting file). Work and push ONLY on `claude/p3-w4c-going-mount`.

1. `git fetch origin main` then `git merge origin/main`; resolve HomeScreen.tsx keeping BOTH sides: main's changes (shell exits / New event / links) AND the Going hero mount (`GoingNightSummary` etc. from this branch). A resolution that drops either side is a bug: after resolving, diff HomeScreen.tsx against both parents and state in the handover what each side contributed.
2. Run every CI job step in the sandbox (read .github/workflows): at least typecheck, the p3 and Going unit tests, lint, `npm run check:bundle-budget` (must still add 0 bytes to dancer-app first load), and the e2e specs that cover P3 Home.
3. Put the PR body text in `docs/handovers/p3-w4c-going-mount-body.md` (plain git cannot edit the PR): `## What changed`, `## Verified on real data` (Shapes surveyed / Checks run / NOT verified), `## Phone QA` with lines `Sizes checked: 390x844`, `Walked:` (say honestly what you walked or "not walked"), `Not verified:`. The orchestrator pastes it into the PR.
4. Push once; end the final commit subject with the worker-done marker given in your prompt.
