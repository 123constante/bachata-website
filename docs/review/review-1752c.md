# Review 1752c: PR #1752 (ci-speed) at cee1fed17, hard tier

Scope: `git diff ce2a99df5 cee1fed17` (one file, scripts/check-phone-qa-skip.mjs, +5/-1), run in a worktree at cee1fed17.

## Verdict: PASS — both round-2 blockers fixed; polarity-blind gating is a pre-existing gap (noted, not blocking)

### 1. Guard on the real file — OK
- `node scripts/check-phone-qa-skip.mjs` -> rc=0 `phone-qa skip guard ok`.
- `--self-test` -> rc=0 `self-test ok: real file clean, mutant refused`.

### 2. Exemption and mutants
- `EXEMPT_JOBS = new Set(['wallclock-budget'])`: named, exact match, one job; any other new job with a heavy step still hits S1.
- Mutant d (`if: always() # steps.mode.outputs.run == 'true'` on Setup Node): now REFUSED (S2) — `[^\n#]` stops at the comment.
- SURVIVES: a heavy step (`npm ci && npx playwright install`) added to wallclock-budget. Justified: that job never runs the phone suite and has no docs-only classifier; the cost is visible in its 5-minute timeout. Acceptable, but a follow-up could refuse HEAVY other than setup-node inside exempt jobs.
- SURVIVES (pre-existing, same class on main's #1751 guard): the guard checks a skip output is *named* in `if:`, not its polarity. `run == 'false'`, `${{ !steps.mode.outputs.run }}` and `always() || steps.mode.outputs.run == 'true'` all pass. Not introduced by this PR; follow-up ticket suggested (require `== 'true'` / `!= 'true'` forms, refuse `||`).

### 3. No other change; round-2 items 1 and 3 hold
- `git log ce2a99df5..origin/claude/ci-speed` = cee1fed only; diff touches only the guard script.
- Order in job phone-qa unchanged: `id: changes` (l.118) -> `id: mode` (l.133) -> guard step (l.149-150) -> heavy steps gated `steps.mode.outputs.run == 'true'`. TARGETS line in prove-entry-point-dispatch.mjs (l.179) present.
- Fail-safe intact: missing E2E_SKIP/CI_LIGHT -> mode=full, run=true; ci_light beats skip.

### CI at head (GitHub MCP check runs, 2026-11-17 ~16:32Z; `gh` not available here)
Green: wallclock-budget, wallclock-brand, bom-check, dancer-area-isolation, route, real-data-verified, no-preview-reason (x3). Skipped: preview/og/seo/lighthouse/synthetic jobs, bom-check-routed, enable.
In progress: phone-qa (1/2/3), build-smoke, e2e-smoke, integrity, contract-check, unit (x3). None red at time of check.

## Hard-tier: PASS
