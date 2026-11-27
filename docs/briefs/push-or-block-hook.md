# BRIEF: push-or-block-hook (WEBSITE; new branch `claude/push-or-block-hook`; careful lane; HARD-TIER scripts and settings)

Brief-version: 2
Owner decision 2026-11-05: a worker may not end its turn with unpushed commits (Layer 1 of auto-push; Layer 2, the done marker, is already in place). Prove it on one throwaway case before relying on it.

## What main lacks
- A Stop hook script `scripts/hooks/push-or-block.mjs` and its registration in the repo's `.claude/settings.json` -- grep: no tracked file `scripts/hooks/push-or-block.mjs`; `.claude/settings.json` has no Stop hook naming it

## What to do
1. Red first: `tests/pushOrBlockHook.test.ts` (table-driven over a temp git repo with a bare remote), then the script.
2. The hook reads the Stop payload, finds the branch, and runs `git fetch origin <branch>` then `git log origin/<branch>..HEAD`:
   - branch not `claude/*`: allow (exit 0);
   - no unpushed commits: allow;
   - unpushed commits and no `stop_hook_active`: BLOCK (exit 2) with one line on stderr: `Unpushed commits on <branch>: push now (one push), end the final subject with your [worker-done <ticket>] marker, then stop.`;
   - `stop_hook_active` already true (second stop): allow, so a worker that cannot push never loops, and write the line `PUSH-BLOCKED <branch> <n> commits` to `docs/handover/` is NOT done; print it on stderr only;
   - remote branch missing counts as all commits unpushed; fetch failure allows and prints a warning (never traps a worker on a network error).
3. Register it in `.claude/settings.json` under `hooks.Stop` without removing existing hooks; a test parses the file and asserts the entry exists and the script path is valid.
4. Throwaway proof: in the PR body show one run on a scratch branch where the hook blocked once and then allowed after a push, and one where it allowed on `stop_hook_active`.
5. Mutants (list in the PR body, each must turn a test red): never block; block when no unpushed commits; ignore `stop_hook_active`; treat fetch failure as block.
6. Per-job table and Verified / Not verified in the PR body, with the exact labels `Verified on real data:` and `NOT verified:`. Run every applicable CI job step.
7. COMMITS: separate plain commands (`git add <files>`, `git commit -F <msgfile>`, `git push origin claude/push-or-block-hook`). No `&&` chains, no `-c` flags. ONE push; final subject ends with the done marker of your ticket.

## Files
- scripts/hooks/push-or-block.mjs
- tests/pushOrBlockHook.test.ts
- .claude/settings.json
