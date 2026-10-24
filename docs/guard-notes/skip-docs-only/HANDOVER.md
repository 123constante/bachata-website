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

A list longer than 1000 files (10 pages of 100) is judged, never guessed.

## Continuation 2026-10-24: read the whole file list (pagination)

Brief: `briefs/GUARD-paginate-files-brief.md` on `brief/people-arc` (blob
`7cf30f93`). The live sweep on head `0ccd46a2` printed `skipped docs-only: 0
(of 73 conflicting claude/ PR(s) checked)`: the 12 docs-only PRs (#766 #767
#768 #824 #825 #831 #835 #837 #838 #839 #844 #884) carry 144-448 files each,
more than the one page of 100 that was read, so none could be whole.

What changed in `fetchDocsOnly` (new helper `takeFilesPage`):
- The files selection now asks for `pageInfo{hasNextPage endCursor}`. A batch
  of 20 is read in ROUNDS: round 1 is every PR's first page (as before); each
  later round is ONE call carrying the next page of every PR still docs so far,
  one alias plus one `$a<n>` cursor variable each. So a batch costs at most 10
  calls, whatever the number of long PRs (live today: about 4 extra calls a
  sweep, not one per PR page).
- **Cap: `FILES_PAGE_CAP = 10` pages (1000 files).** A list still not whole at
  the cap is NOT docs-only (FAIL), never a guess.
- **Early exit:** a PR leaves the rounds at its first page holding a non-docs
  file, so the live cost stays with the docs-only PRs.
- A cursor that is missing, empty or equal to the previous one is NOT
  docs-only, so a stuck cursor cannot loop (it stops on the second read).
- The list must hold still while it is read: every page's totalCount must
  equal the first page's, and no path may appear twice (a push between page
  reads shifts GitHub's offset cursors and could hide a new code file). The
  integer-totalCount-equals-paths check runs on the assembled list.
- A null file node is NOT docs-only instead of a TypeError (exit 2).
- A 5xx/network outage on any round leaves the PRs still undecided in that
  batch, plus every later candidate, NOT JUDGED; a PR its first page already
  decided keeps its verdict (a conflicting code PR still FAILs, exit 1). Any
  other error exits 2. The `skipped docs-only:` line adds `, U of them NOT
  read` when an outage left candidates unread.

Self-test: 94 cases (17 new `docs-long:` cases; 77 before). Red first: the
first 10 were written before the implementation and 7 of them failed against
`0ccd46a2` (3 held: code on page 3, the totalCount mismatch, and the page-1
early exit, because a long list was never docs-only). The other 7 came from
the review round (list moved between reads x3, null cursor on a later page,
null node, 401 on page 2, two long PRs sharing a call) and are proven by
mutation instead. Mutants against the final code, every one killed: drop the
cursor (4 cases red), drop the cap (1), drop the early exit (3), drop the
stuck-cursor check (1), drop the missing-cursor check (1), drop the per-page
totalCount check (1), drop the unique-path check (1), leave undecided PRs out
of `unread` (4), treat a non-outage error as an outage (2), drop the null-node
guard (1), mark the whole batch unread (1).

Review: one round (CI-guard rule), 12 findings, all taken as edits except
"share one paging helper with `listOpenPrNumbers`": the two answer a stuck
cursor differently (the PR list throws, a files list is NOT docs-only), so one
helper would need a policy flag for its only difference. Both now treat an
empty or missing cursor as stuck.

Live numbers: NOT measured from the sandbox (`HTTP 401` from GraphQL again).
The orchestrator's re-run should print `skipped docs-only: 12 (of 73 ...)` and
61 FAIL (if the board has not moved since).

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
- Checks run (first PR, at `0ccd46a2`): `--self-test` 77/77 (red first: 4 of 66 failed against main's script before the implementation); 16 mutants, every one killed (the brief's 5, then 11 against the final code, including the brief's 5 again); `npm run lint` 22/22 links (exit-126 `check:integrity` is the checkout's missing exec bit, which CI's `chmod +x bin/*.sh` step supplies; green with it set); `npx eslint scripts/check-pr-mergeable.mjs` clean; `check:script-conventions` pass; `prove:entry-point` 48/48; `scripts/ci/docs-only.mjs --self-test` ok; no backslash in the script.
- Continuation (pagination): `--self-test` 94/94, 11 mutants killed, lint chain 22/22, eslint clean on the script, no backslash. NOT verified: the live sweep again (HTTP 401 from the sandbox token); expected `skipped docs-only: 12`, 61 FAIL.
- First PR, NOT verified: the live sweep. Expected roughly 37 SKIPPED and 36 FAIL of the 73 conflicting PRs, but there are no actual numbers. Run `node scripts/check-pr-mergeable.mjs` with a real token and read the `skipped docs-only:` line. Note that the skip count may come in below about 37: `.md` under `scripts/`, `src/` or `.github/` now counts as code. Also not verified: PR CI on GitHub at the time of writing.

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
| pr-mergeable-guard: self-test | PASS 94 (continuation; 77 at `0ccd46a2`) |
| architecture-guard: lint chain / conventions / entry-point | green (see above) |
| PR checks on GitHub | see the PR; not read from the sandbox |
