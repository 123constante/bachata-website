# GUARD-CI: Mergeable Guard skips docs-only worker PRs (visibly)

Orchestrator 2026-10-24. Branch `claude/guard-skip-docs-only` (new, from origin/main f3f2f33c or later). Lane: normal, ONE PR, ONE review round (CI-guard rule). Continuation of #1013 (merged): same file `scripts/check-pr-mergeable.mjs`, same conventions. No migration, no `supabase/**`, no `.github/workflows/**` edits.

## Why (owner click answer 2026-10-24: "Skip docs-only, list the rest")
After #1013 the guard finishes (run 40128893960: 137 open PRs read, no 504, canary ok) and is red for a TRUE reason: 73 open PRs are CONFLICTING. Survey of those 73: all non-draft, all `claude/*` worker branches, all created in October; titles: docs 37, feat 30, fix 3, test 2, wip 1. Skipping drafts would remove none of them. The owner chose: the guard stops judging docs-only worker PRs; the ~36 code PRs stay judged and the owner cleans them up from a list.

## Build
1. A PR is **docs-only** when EVERY changed file is a Markdown file or lives under `docs/`, `briefs/` or `plans/` (state the exact rule in the header comment). Decide how to read the changed files cheaply: the #1013 detail query is 20 PRs per call and must not grow back toward the 504 (11 s). Options: add `files(first: 100) { nodes { path } totalCount }` to the detail query and measure; or a separate REST/GraphQL call only for PRs that would otherwise FAIL (conflicting, no gates), which is far fewer. Pick by measurement; report nodes per call and the live timing. A PR whose file list is longer than the page fetched is NOT docs-only (never guess).
2. Scope: ONLY PRs whose head ref starts with `claude/` (worker PRs). A human or Dependabot docs PR that conflicts is still judged. Drafts stay judged (no special case).
3. A skipped PR is never silent and never counted as OK: print one line per PR `SKIPPED docs-only #N <head>` and a total `skipped docs-only: K`, keep it out of the "gates ran" tally, do not publish a commit status to it (or publish a neutral one only if the existing code already publishes neutral states; say which). It does not affect the exit code.
4. The H1/H2 rules and everything else from #1013 are unchanged (retries, paging, outage, exit codes, status de-dupe).

## Tests (red first)
Extend the `--self-test` (it drives `main()` against a sealed fake GitHub): docs-only claude PR conflicting -> SKIPPED, exit 0; the same PR with one `src/` file -> FAIL exit 1; docs-only but head `dependabot/...` or a human branch -> FAIL; Markdown at repo root only -> docs-only; `docs/` file plus one `.ts` -> not docs-only; file list truncated (totalCount > nodes) -> not docs-only, judged; a skipped PR is absent from the OK tally and from status publishing. Run them against the current script first and show red. Mutants: treat any claude PR as docs-only; ignore a non-docs file; skip non-claude PRs; count a skipped PR as OK; swallow the SKIPPED line (each must be caught; a mutant with zero failing lines is a test defect).

## Verify on the real thing
Run the new sweep read-only against the real repo from your sandbox if it has a token (the #1013 worker had none: say plainly if so; the orchestrator will run it). Expected live result: of the 73 conflicting, about 37 SKIPPED and about 36 FAIL; report your actual numbers.

## Checks, handover
Run every CI job step that applies (read `.github/workflows`; `npm run lint`, `check:script-conventions`, `prove:entry-point`, the script's self-test). No backslash character in the script (newline is `String.fromCharCode(10)`, no regex literals). Add two sentences to the Mergeable Guard entry in `docs/ci-guard-notes.md`. Put ready-to-paste PR body text in `docs/guard-notes/skip-docs-only/HANDOVER.md`: `## Verified on real data` (heading EXACTLY that; lines starting `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: `) and `## Phone QA` (`- Not applicable: no visible change`), plus head sha, measurement table, per-job CI table. No design record. Context under 50%. One push; do not put `[skip preview]` on the final push.
