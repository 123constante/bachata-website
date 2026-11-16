# Brief: independent review of Website PR #1728, round 1 (session-lock block hook twin)

Repo `123constante/bachata-website`, PR #1728, branch `claude/lockblock-pretooluse-twin`, head `7fea3b1f00e3507600b1d247b379492faa581381`.
You are the REVIEWER. Do not change code on the PR branch. Write your review doc to `docs/review/1728-r1.md` on your own branch `claude/review-1728-r1` and push it.

## Context
This is the Website twin of admin PR #1879 (merged as `53e6acb0` in `123constante/bachata-admin`, reviewed there in two rounds, Hard-tier PASS).
The PR has 3 changes:
- `scripts/hooks/session-lock-block.mjs`: claimed byte-identical to admin `scripts/hooks/session-lock-block.mjs` at `53e6acb0`.
- `.claude/settings.json`: a PreToolUse entry (matcher `Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell`, timeout 10) runs the hook.
- `scripts/prove-entry-point-dispatch.mjs`: TARGETS entry for the new hook (the Website pre-push gate requires every `isEntryPoint` script to be listed).
`scripts/hooks/session-lock.mjs` and its SessionEnd `release --hook` wiring already exist on Website main.

## Check
1. Byte-identity: fetch admin `53e6acb0:scripts/hooks/session-lock-block.mjs` (public API or `git clone --filter=blob:none`), compare with the PR file. Any difference is a finding.
2. Website-specific fit: the hook's paths, lock file location and repo-root resolution work in the Website repo layout (no admin-only path, script or env var it depends on). The `cd "${CLAUDE_PROJECT_DIR:-.}"` wrapper matches the other Website hooks.
3. Wiring: the PreToolUse entry is valid JSON in the right array; it does not shadow or reorder an existing PreToolUse hook's behaviour.
4. Run the hook's self-test both directions (foreign live lock: blocked; own session / subagent payload / no lock: allowed). Run `npm ci --ignore-scripts` if needed, then `node scripts/prove-entry-point-dispatch.mjs` and `npm run test:unit`; paste the summary lines.

## Output
`docs/review/1728-r1.md` with findings (severity, file:line), a verdict, and EXACTLY one line `## Hard-tier: PASS` or `## Hard-tier: BLOCK` naming head `7fea3b1f`. Do not merge or approve.
