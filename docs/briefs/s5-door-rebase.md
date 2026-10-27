# Brief: rebase PR #1034 (S5 public door screens, PARKED: do not merge, needs admin #1018) onto current main -- mechanical, no new features

Lane: normal, Haiku. Repo 123constante/bachata-website. Branch `claude/s5-door-screens` (PR #1056, CONFLICTING with main). Goal: make the PR MERGEABLE so the PR Mergeable Guard stops failing. Do not change what the PR does.

## Steps
1. `git fetch origin main claude/s5-door-screens`, check out `claude/s5-door-screens`, `git rebase origin/main`.
2. Resolve conflicts keeping BOTH sides' intent: main wins for anything unrelated to the door; this PR wins for the /run-events door screens, closed page, start-your-page, VITE_ORGANISER_DOOR gating. Never touch `supabase/migrations/` (must not exist in this repo), calendar density-excluded files beyond what the PR already changed, or `.github/workflows`.
3. If a conflict is not obviously mechanical (logic on both sides of the same lines), STOP: leave the branch untouched, write the conflicting file names and both intents in `docs/handover/s5-door-rebase.md` on a branch `claude/done-<ticket>` and report. Do not guess.
4. After a clean rebase run: `npx tsc --noEmit`, `npm run lint`, `npm run test:unit -- --maxWorkers=3` (known sandbox failures: 5 in `tests/integrityCouldNotRun.test.ts`). Fix only breakage caused by the rebase.
5. Push with `--force-with-lease` to `claude/s5-door-screens` ONCE (Vercel cap). Final commit subject ends with the done marker from your prompt.

## Do NOT
Add features, edit unrelated files, merge or approve, touch other branches, use `--no-verify`.

## Done =
Branch pushed, PR #1056 shows MERGEABLE (`git` merge-base check is enough; the orchestrator reads the PR), short report: conflicts resolved (files), test/typecheck result, honest Not verified.
