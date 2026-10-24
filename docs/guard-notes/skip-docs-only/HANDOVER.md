# HANDOVER: Mergeable Guard skips conflicting docs-only worker PRs (visibly)

Branch `claude/guard-skip-docs-only`, from main `f3f2f33c`. Class: GUARD-CI, one
review round (the CI-guard rule). Brief: `briefs/GUARD-skip-docs-only-brief.md`
on `brief/people-arc`. Head sha: the commit that adds this file (the PR head).

## Summary (ready-to-paste PR body)

`scripts/check-pr-mergeable.mjs` no longer fails a **CONFLICTING** PR whose head
starts with `claude/` and whose changed files are all docs. Each one prints
`SKIPPED docs-only #N <head>`, the sweep prints `skipped docs-only: K (of C
conflicting claude/ PR(s) checked)`, and the pass line names the skipped count.
A skipped PR is out of the ok tally and the judged count, gets **no** commit
status, and does not change the exit code. The script publishes only
success/failure/pending, so it has no neutral state to give.

**Docs-only rule (exact).** EVERY changed file passes the repo's one existing
definition, `scripts/ci/docs-only.mjs` `isDocsOnly`, or lives under `briefs/`:
- that definition covers `docs/`, `.claude/rules/`, `plans/`, and `.md`
  anywhere, the repo root included;
- `.md` under src/ public/ .github/ scripts/ tests/ app/ api/ supabase/ bin/
  .githooks/ components/ e2e/ .vercel/ server/ does NOT count.

The skip also needs all three of these:
- no file is RENAMED or COPIED (GraphQL shows only the new path);
- `totalCount` is an integer equal to the number of paths fetched;
- at least one file changed.

A list longer than 100 files is judged, never guessed.

**Departures from the brief, all from the single review round:**
1. The brief's own rule was "`.md` anywhere". The guard reuses
   `scripts/ci/docs-only.mjs` instead of a second definition. Review showed
   `.md` under src/, scripts/ and .github/ is read by code and tests. The
   brief's cases still hold: root Markdown counts, and docs/ plus `.ts` does not.
2. Only a CONFLICTING failure is skipped. A MERGEABLE docs PR with an empty
   board still FAILs NO_GATES_RAN, because the docs-only workflows keep their
   jobs running and H2 is the durable half.
3. Files lost to a 5xx/network outage leave the PR **NOT JUDGED** under the
   existing outage policy, not FAIL. Any other error on that read (401, a bad
   query) exits 2.

Unchanged: H1/H2, retries, paging, outage exit codes, status de-dupe, `--sha`
canary.

## Measurement

| query | PRs per call | nodes per call (max) | when |
|---|---|---|---|
| list | 100 | 100 | every sweep |
| detail (#1013) | 20 | 20 x 100 contexts = 2,000 (+1 field: `headRefName`) | every sweep |
| files (new) | 20 | 20 x 100 files = 2,000 | only conflicting claude/ PRs, about 73 now = 4 calls |

The detail query grew by one scalar field, not a connection. Live timing was
NOT measured. The sandbox `GH_TOKEN` and `GITHUB_TOKEN` are rejected by GraphQL
(`HTTP 401 Bad credentials`), so the orchestrator must run it.

## Verified on real data

- Shapes surveyed: none live. The sandbox token gets HTTP 401 from api.github.com/graphql. The fixtures model the brief's surveyed shapes: conflicting claude/ docs PRs, code PRs, Dependabot and human heads, truncated lists, renames, `.md` under src/ and .github/, an empty board, and partial outages.
- Checks run: `--self-test` 77/77 (red first: 4 of 66 failed against main's script before the implementation); 16 mutants, every one killed (the brief's 5, then 11 against the final code, including the brief's 5 again); `npm run lint` 22/22 links (exit-126 `check:integrity` is the checkout's missing exec bit, which CI's `chmod +x bin/*.sh` step supplies; green with it set); `npx eslint scripts/check-pr-mergeable.mjs` clean; `check:script-conventions` pass; `prove:entry-point` 48/48; `scripts/ci/docs-only.mjs --self-test` ok; no backslash in the script.
- NOT verified: the live sweep. Expected roughly 37 SKIPPED and 36 FAIL of the 73 conflicting PRs, but there are no actual numbers. Run `node scripts/check-pr-mergeable.mjs` with a real token and read the `skipped docs-only:` line. Note that the skip count may come in below about 37: `.md` under `scripts/`, `src/` or `.github/` now counts as code. Also not verified: PR CI on GitHub at the time of writing.

## Phone QA

- Not applicable: no visible change

## Known residuals (owner calls, not fixed)

- A skipped PR keeps whatever `pr-mergeable-guard` status an earlier sweep
  wrote. That can be a stale `success` from before it conflicted, or a
  `failure` from before this change. The brief pins "do not publish". The other
  option is a `pending` "skipped: docs-only" status, which would need an owner
  call.
- A conflicting docs PR's docs gates (mojibake, journey-grid on
  `docs/account-system/ACCOUNT-MODEL.md`) never queue, and the guard no longer
  says so. Owner decision: "Skip docs-only".

## Per-job CI

| job | local result |
|---|---|
| pr-mergeable-guard: self-test | PASS 77 |
| architecture-guard: lint chain / conventions / entry-point | green (see above) |
| PR checks on GitHub | see the PR; not read from the sandbox |
