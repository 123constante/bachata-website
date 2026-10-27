# Brief: rebase PR #1056 (Bristol polish) onto current main -- mechanical, no new features

Lane: normal, Haiku. Repo 123constante/bachata-website. Branch `claude/bristol-polish` (PR #1056, 54 files, CONFLICTING with main). Goal: make the PR MERGEABLE so the PR Mergeable Guard stops failing. Do not change what the PR does.

## Steps
1. `git fetch origin main claude/bristol-polish`, check out `claude/bristol-polish`, `git rebase origin/main`.
2. Resolve conflicts keeping BOTH sides' intent: main's changes win for anything unrelated to Bristol/city-aware copy; this PR's changes win for city-aware copy, empty-city note, teacher tip form, map centre, venues by city. Never touch `supabase/migrations/` (must not exist in this repo), calendar density-excluded files beyond what the PR already changed, or `.github/workflows`.
3. If a conflict is not obviously mechanical (logic on both sides of the same lines), STOP: leave the branch untouched, write the conflicting file names and both intents in `docs/handover/bristol-polish-rebase.md` on a branch `claude/done-<ticket>` and report. Do not guess.
4. After a clean rebase run: `npx tsc --noEmit`, `npm run lint`, `npm run test:unit -- --maxWorkers=3` (known sandbox failures: 5 in `tests/integrityCouldNotRun.test.ts`). Fix only breakage caused by the rebase.
5. Push with `--force-with-lease` to `claude/bristol-polish` ONCE (Vercel cap). Final commit subject ends with the done marker from your prompt.

## Do NOT
Add features, edit unrelated files, merge or approve, touch other branches, use `--no-verify`.

## Done =
Branch pushed, PR #1056 shows MERGEABLE (`git` merge-base check is enough; the orchestrator reads the PR), short report: conflicts resolved (files), test/typecheck result, honest Not verified.
