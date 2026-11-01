# Brief: p3-wt-gate CONTINUATION (CI parity, PR #1250)

Repo bachata-website, branch claude/p3-wt-gate (SAME branch, PR #1250 exists), lane normal, Opus. A previous worker stopped at its context limit. Read its handover first: `docs/handover/p3-wt-gate.md` on this branch ("Left / next steps"). The earlier brief is `docs/briefs/p3-wt-gate.md` on branch brief/p3-wt-gate; its scope and "do NOT touch" lists still bind. Do NOT add scope.

## Do exactly this (the handover's items 1, 2, 4-prep)
1. CI parity: read `.github/workflows/*.yml` for every job that applies to this PR and run every step you can in the sandbox: `npm run lint` chain, `npm run build`, `npm run check:bundle-budget` on main AND on the branch (the PR must add 0 bytes to dancer-app first load; RepeatSheet newly imports `gateRule`/`statusQuery`: if bytes move, fix by lazy import, never by editing `perf-budgets.json` or `vite.config.ts`), `npm run test:e2e` specs that apply, and the p3 e2e. Put a per-job table (command, result, or "not runnable here and why") in the PR body.
2. Write the 390x844 overlay e2e for the gate sheet, the Repeat held note and the Tickets sheet: sheet, confirm button and toast boxes sit inside the viewport; opening a sheet does not scroll the page (`focus({ preventScroll: true })`).
3. `node scripts/check-onboarding-write-doors.mjs` (without --live) must pass with the edited `scripts/onboarding-write-doors.json`. Keep the note in the PR body that this is a hard-tier path needing the owner Approve at head.
4. Fix the PR body so it contains the lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and a `## Phone QA` section (copy the shape survey from the handover; Phone QA: the gate flag is OFF in prod, so say what can only be walked on a branch DB).
5. Early checkpoint push (subject ends [skip preview]), then the final push with the done marker. Update the handover file. Hard limits in the dispatch prompt apply.

Out of scope: any new fix to F-10/11/12/15 beyond what CI parity forces (report anything else in the handover instead).
