# BRIEF: worker-commit-helper (WEBSITE; new branch `claude/worker-commit-helper`; careful lane; HARD-TIER scripts)

Brief-version: 2
Owner decision 2026-11-05: workers and reviewers commit through ONE helper so identity, message form and the done marker are never hand-typed (permission prompts on multi-line `-m` and `-c user.name` flags stranded a review worker on 2026-11-05).

## What main lacks
- `scripts/worker-commit.mjs` -- grep: no tracked file `scripts/worker-commit.mjs` and no `tests/workerCommit.test.ts`

## What to do
1. Red first: `tests/workerCommit.test.ts` (table-driven) then the script.
2. `node scripts/worker-commit.mjs --subject "<one line>" [--body-file <path>] [--marker dt_xxx] [--files a,b]`:
   - refuses when the current branch is not `claude/*`, `brief/*` or `review/*`;
   - refuses a multi-line `--subject`, an empty subject, and a marker not matching `^dt_[0-9a-f]{12}$`;
   - stages only `--files` (or refuses with the list of unstaged changes when none given and the tree is dirty and `--all` is absent);
   - writes the full message (subject + marker suffix ` [worker-done dt_xxx]` + optional body + the attribution trailer lines read from `--trailer-file` if given) to a temp file and runs `git commit -F <file>`; never uses `-m`, never sets `-c user.name` or `-c user.email` (identity comes from the environment already configured);
   - prints the new head sha; exit codes: 0 ok, 1 refused, 2 git failure.
3. It never pushes (one push per slice stays a separate, visible step) and never runs `--no-verify`; add a test that the argv it builds contains neither.
4. Self-test and a mutant check: remove each refusal in turn and show a test goes red (list the mutants in the PR body).
5. Docs: one paragraph in `docs/automation-foundations.md` naming the helper as the only commit path for workers.
6. Per-job table and Verified / Not verified in the PR body, with the exact labels `Verified on real data:` and `NOT verified:`. Run every applicable CI job step.
7. COMMITS: you cannot use the helper yet; run git as separate plain commands: `git add <files>`, `git commit -F <msgfile>`, `git push origin claude/worker-commit-helper`. No `&&` chains, no `-c` flags. ONE push; final subject ends with the done marker of your ticket.

## Files
- scripts/worker-commit.mjs
- tests/workerCommit.test.ts
- docs/automation-foundations.md
