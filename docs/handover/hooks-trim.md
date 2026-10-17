# Handover: hooks-trim (session-boot trim)

## What changed
- `scripts/hooks/session-boot.mjs`: boot output is now branch + `git status -sb` (max 10 lines), last 3 commits,
  and one line for the newest `~/.claude/plans/HANDOVER-*.md` when it exists. Dropped from boot: open-PR list,
  stale-origin warning, review-stamp age line. All other hooks and `.claude/settings.json` untouched; the pre-push
  review-stamp gate is unchanged (`scripts/lib/review-scope.mjs` is no longer imported by the boot hook only).

## Boot output size
Before: 15 lines (with `gh` unavailable). After: 8 lines.

## Tests
No test pinned the removed sections (grep for `session-boot` finds only the hook and `settings.json`).

## CI per-job table
| Step | Command | Exit | Result |
|---|---|---|---|
| Production build | `npm run build` | 0 | pass |
| Script conventions | `node scripts/check-script-conventions.mjs` | 0 | pass |
| eslint on the file | `npx eslint scripts/hooks/session-boot.mjs` | 0 | no output |
| Hook run | `node scripts/hooks/session-boot.mjs` | 0 | valid JSON, 8 lines |

Not run: the full `npm run lint` chain, unit and e2e suites (no source under `src/` changed).

## Phone QA
No UI change.

## Verified / Not verified
Verified: hook output, build, conventions guard. Not verified: full CI on GitHub, the SessionStart hook inside a
fresh Claude Code session with a real `~/.claude/plans/HANDOVER-*.md` present (logic read-checked only).

## What is left
Nothing. The bot opens the PR.
