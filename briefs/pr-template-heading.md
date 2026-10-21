# Brief: one-line PR template fix (Website)

Repo `123constante/bachata-website`. Branch `claude/pr-template-heading` off `main`. Model: Sonnet. Push ONCE at the end.
Open ONE bot-authored PR (`gh pr create` with the bot token in the environment). Never merge or approve.

## What the owner saw, and the check that would have caught it
Every Website PR that keeps the template as written fails the `real-data-verified` check. The template
`.github/pull_request_template.md` (line ~46) ships the heading `## Verified on real data (required)`, but
`scripts/check-pr-real-data-verified.mjs` `HEADING_RE` only accepts `## Verified on real data` with nothing after
it, so the orchestrator has had to hand-fix PR bodies (#913). The missing check: `tests/phoneQaSection.test.ts`
"the PR template, filled in as written, passes" - run it on UNFIXED main first and record whether it fails.

## Task (exactly this, nothing else)
1. Run `npx vitest run tests/phoneQaSection.test.ts` on unfixed main; record the result (red-first).
2. In `.github/pull_request_template.md`, change `## Verified on real data (required)` to `## Verified on real data`.
   If the "required" meaning should stay, put it on the line BELOW as plain text or an HTML comment, never on the heading.
3. Re-run the test; it must pass. If it was already green on main, say so plainly and explain why (do not invent a red).
4. Grep the repo for any other copy of the old heading (docs, scripts, other templates) and fix only exact copies.

## Gates
- Read `.github/workflows/*.yml`; run every step you can for this change (at least the unit test above,
  `npm run lint`, typecheck). A production build is not needed for a markdown-only change; say so.
- GitHub Actions may be refused for billing ("payments have failed / spending limit"): not a code failure; your
  per-job table (command, exit code) in the PR body is the fallback evidence.
- The PR body itself must contain a passing `## Verified on real data` section (Sizes checked / Walked / Not verified:
  say "n/a - template-only change, no screen" where true).

## Rules
- Read and push with PLAIN git (`git fetch`, `git show`, `git push`), never `gh api` (it stalls on a prompt).
- Write shell commands WITHOUT variables, loops or `$(...)` where a plain command works.
- Never `--no-verify`. Supabase is not needed; do not touch it.
- Last push commit subject ends with `[worker-done <ticket>]`. Stop after the push and the PR, and report.
