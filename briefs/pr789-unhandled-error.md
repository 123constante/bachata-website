# Brief: PR #789, fix the one red GitHub unit job (unhandled error), one pass

Repo: 123constante/bachata-website. Branch: `claude/dancer-journey-fixes` (PR #789, head `982d74f`). Push to THIS branch only.
Model: Sonnet. You are the only worker on this branch.

## The failure (real GitHub Actions, job "unit (Europe/London, full)")
All 371 files / 9041 tests passed, but the job exits 1 on ONE unhandled error:
```
Uncaught Exception
TypeError: document.elementFromPoint is not a function
 ❯ Timeout._onTimeout node_modules/input-otp/src/use-pwm-badge.tsx:107:37
This error originated in "src/components/__tests__/MagicLinkConfirmationEmail.test.tsx" ...
latest test: "renders the 49-character address with the shared EmailText"
```
`input-otp`'s password-manager badge runs a timer after render that calls `document.elementFromPoint`, which happy-dom
lacks. The sandbox runs missed it (timing), so it is newly red against main.

## Do
1. Fix at the right altitude: if other tests render `InputOTP` too, give the shared vitest setup a harmless
   `document.elementFromPoint` stub (only when it is missing) so EVERY such test is safe; otherwise fix the one test
   (unmount + clear timers, or the stub in the file). Prefer the shared stub; one place, a comment saying why.
2. Prove it: run `src/components/__tests__/MagicLinkConfirmationEmail.test.tsx` with `--reporter=verbose` before (shows
   the unhandled error, exit 1) and after (exit 0); then the full `npm run test:unit` once (exit 0 apart from the
   pre-existing no-network contract files the handover lists; there must be NO "Unhandled Errors" section).
3. Add one line to `docs/handovers/dancer-journey-fixes.md` (Continuation section): the failure, the fix, before/after exit.

## Rules
- Plain git for read and push. NEVER `gh api`. No new PR, no labels, do not edit PR #789. ONE push only (each push builds
  a Vercel preview and Vercel is rate-limited today).
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge or approve. Never `--no-verify`. Supabase read-only (not needed).
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.

## Output
The single push's commit subject ends with `[worker-done <ticket>]`.
