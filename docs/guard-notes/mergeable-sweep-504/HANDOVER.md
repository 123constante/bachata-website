# GUARD-CI: PR Mergeable Guard sweep dies on GitHub HTTP 504 &mdash; handover

Brief: `briefs/GUARD-mergeable-sweep-504-brief.md` on `brief/people-arc`
(sha b559b75b). Branch `claude/guard-mergeable-sweep-504`, one PR, one push.
Class: GUARD-CI, so one review round (xhigh): 14 findings, 12 fixed, 2 answered below.

- **Head SHA / PR number:** in the PR description and the worker report (a
  commit cannot carry its own sha).
- **Files:**
  - `scripts/check-pr-mergeable.mjs`: the fix and its self-test.
  - `scripts/script-conventions-allowlist.json`: one stale R5 entry removed,
    because the canary now drives `main()`.
  - `docs/ci-guard-notes.md`: one paragraph.
  - This file.
  - No workflow, no `supabase/**`, no app code.
- **Workflow edit:** none needed for the sweep. One is needed for the canary
  step during an outage; it is optional and the owner's call (see "Exit codes").

## The defect, measured

The brief's hypothesis was right, but it was not the whole story.

- Run 40121097694 (push to main, 2026-10-24 18:31Z), step "Sweep open PRs":
  started 18:31:42.77, and `GitHub API HTTP 504` (the "Unicorn!" page) arrived
  at 18:31:53.87. That is **11.1 s**, which is GitHub's ~10 s GraphQL timeout.
  The canary step (`--sha`, one commit) was green in the same run.
- The sweep was ONE query: `pullRequests(states:OPEN, first:100)`, each with
  `commits(last:1){ statusCheckRollup{ contexts(first:100) } }`. That is up to
  100 x (1 commit + 100 contexts) = **~10,100 nodes**, and the whole board was
  re-read up to 6 times while any PR was `UNKNOWN`.
- **136 PRs are open** (GitHub REST list, 100 + 36, about 18:50Z). The old code
  refused a short page ("saw 100 of 136; paginate"). So even a query that
  answered would have exited 2, and a lighter query alone would not have fixed it.

## Measurement table

| | Before (origin/main 8d82d61) | After (this PR) |
|---|---|---|
| PRs open | 136 | 136 |
| Calls to list the board | 1 (first:100, so it could not cover 136) | 2 (cursor-paged, 100 numbers per call) |
| Nodes per list call | ~10,100 (PR + rollup) | 100 (`number` only) |
| Calls for details | (same call) | 7 (20 PRs per call, as aliases) |
| Nodes per detail call | (same call) | ~2,020 (20 x 101) |
| Mergeable re-poll | the whole board, up to 5 more times | only OPEN PRs still `UNKNOWN`, 20 per call |
| Status POSTs per sweep | one per PR | only where state or description changed |
| Query time | 11.1 s, then HTTP 504 (run 40121097694) | **NOT measured**: no GitHub token in this sandbox (see NOT verified) |

Why 20 per batch: each call is a fifth of the size that timed out, and the
size no longer grows with the board. I could not measure it live, so 20 is a
cautious pick, not a tuned one. `DETAIL_BATCH_SIZE` is one constant.

## What changed in the script

1. **Paging.**
   - `listOpenPrNumbers` reads open PR numbers oldest-first by cursor and keeps
     each number once.
   - It refuses a cursor that does not advance, a list longer than 50 pages, and
     a final count below GitHub's `totalCount` (that last check was in the old
     code; it is restored here).
   - `fetchPrDetails` reads full fields 20 per call, by number.
   - `fetchPrs` re-polls only OPEN PRs that are still `UNKNOWN`. A PR that
     closed mid-sweep is skipped, never judged and never written to.
2. **Retries** (`requestWithRetry`, used by GraphQL AND the status POST).
   - 502/503/504 and network errors (with undici's `cause`), plus a 30 s
     per-request timeout: 3 attempts, 2 s then 5 s apart.
   - Retrying is capped by a 180 s budget, counted only on failed attempts and
     the waits between them, so a long healthy sweep never spends it.
   - A 4xx, or a 200 with an `errors` body, is never retried and exits 2.
3. **Outage.** When the retries are used up, the sweep stops fetching and:
   - lists every PR it did not read, or left `UNKNOWN`, as `NOT JUDGED`, by number;
   - prints `GITHUB-OUTAGE`;
   - publishes nothing to those PRs;
   - raises `::warning title=GITHUB-OUTAGE::` under Actions;
   - never prints the pass line.

   A status POST lost the same way keeps the verdicts and is listed as
   `STATUS NOT PUBLISHED`.
4. **Unchanged status not re-posted.** The rollup now carries our own status's
   `description`. A POST is skipped when the state and description already
   match. Paging is what first lets the sweep reach 136 POSTs per run, hourly
   and on every push to main, and `GITHUB_TOKEN` gets about 1,000 REST calls an
   hour per repo.
5. **Seam.** `main(argv, deps)` and `run(opts, deps)` take injected `fetch`,
   `sleep`, `now`, `env` and page sizes, in the shape of `check-ci-budget.mjs`.
   The self-test drives `main()`, which settles this file's R5 debt.
6. **Kept as they were:**
   - no backslash in the file (`grep -c` gives 0);
   - `isEntryPoint` dispatch;
   - H1/H2 and the grace window;
   - the `--sha` canary;
   - the 0/1/2 contract, apart from the one outage exception, now stated in the header.

## Exit codes

| Situation | Exit | Workflow effect |
|---|---|---|
| Every judged PR is mergeable with a gate that ran | 0 | green |
| A judged PR is CONFLICTING, or no gate ran (H1/H2) | 1 | red, **even during an outage**: a judged conflict outranks it |
| No credential, bad repo, 4xx, GraphQL `errors`, partial rollup or short list, publish refused (4xx), mergeable unresolved with no outage | 2 | red (unchanged) |
| **GITHUB-OUTAGE** in the sweep (502/503/504 or network error, still failing after 3 attempts) | **0** (`PR_GUARD_OUTAGE_STRICT=1` gives 2) | sweep step green, with a warning annotation and a NOT JUDGED list in the summary |
| `--sha` canary during an outage | 2 (unchanged) | canary verdict `unreadable`, so the "Fail the job when the canary was not healthy" step **reds the job** |

**Why 0, and not a new code:** `pr-mergeable-guard.yml` reds on ANY non-zero
exit from the sweep step (`set -o pipefail` + `tee`), and the brief says to
edit no workflow. What stops 0 from hiding an outage:

- no pass line;
- the unjudged PRs are named;
- the annotation on the run page;
- the step summary carries the log.

**The gap I could not close without a workflow edit (review finding #2).**
In a real outage the canary (`--sha`, one light query, run first) usually
fails as well. It exits 2 and the job goes red through the canary-health step,
even when the sweep exits 0. The retries make a short blip survive. A long
outage still reds main through the canary. The exact edit, for the owner to
decide, is in `.github/workflows/pr-mergeable-guard.yml`, step "Live canary",
in the `elif [ "$code" = "2" ]` branch. Make it tell an outage apart from a
missing fixture:

```sh
elif [ "$code" = "2" ] && grep -q 'attempt(s)' canary.log; then
  echo "verdict=ok" >> "$GITHUB_OUTPUT"
  echo "::warning title=GITHUB-OUTAGE::canary could not reach GitHub; not a blind guard."
elif [ "$code" = "2" ]; then
```

`attempt(s)` appears only in the retry-exhausted message. Taking that branch
skips the canary-health red, and the sweep then reports the outage itself.

## Review round (one round; xhigh; stopping rule stated before it ran)

| # | Finding | Outcome |
|---|---|---|
| 1 | An outage left already-read `UNKNOWN` PRs as judged, so they came out MERGEABLE_UNRESOLVED and exited 2 | fixed: moved to NOT JUDGED; case and mutant added |
| 2 | The canary also fails in an outage and reds the job | needs a workflow edit (above); documented, not built |
| 3 | The status POST had no retry and no timeout | fixed: shares `requestWithRetry`; a lost publish becomes `STATUS NOT PUBLISHED` |
| 4 | The budget was wall-clock from the start of the run | fixed: it counts failed time only; two cases and a mutant |
| 5 | The `totalCount` completeness check was dropped | fixed: restored on the last page; case and mutant |
| 6 | A GraphQL timeout sent as 200 + `errors`, and 403/429 rate limits, are not retried | **not changed**: the brief requires that an `errors` body never retries, and both exit 2 loudly. If GitHub's 10 s resolver timeout shows up in practice, lower `DETAIL_BATCH_SIZE` |
| 7 | 136 POSTs a run can exhaust the REST limit | fixed: unchanged statuses are skipped; case and mutant |
| 8 | A PR closed mid-sweep was re-polled pointlessly | fixed: only OPEN PRs are polled in a sweep |
| 9 | The annotation said "0 PR(s)" when the list itself failed | fixed: it says the list could not be read |
| 10 | The header exit contract omitted the outage exception | fixed: header and `exitCodeFor` docs |
| 11 | The CI table was a placeholder | fixed (below) |
| 12 | Tests missed the budget, outage+UNKNOWN and publish paths; the fake had a dead branch | fixed: 6 cases added; dead branch removed |
| 13 | The seam was partial (`Date.now`, `runUrl` env) | fixed: both injected |
| 14 | Network errors lost undici's `cause` | fixed |

## Tests (red first, then mutants)

The self-test now has 55 cases, 37 before. All 18 new cases drive `main()`
against a sealed fake GitHub; the global `fetch` is swapped too, so nothing
reaches api.github.com. They cover:

- retry once, then pass, in 2 calls
- a network error is retried
- 504 x3 gives GITHUB-OUTAGE, 3 calls, no pass line
- unread PRs are named NOT JUDGED
- the strict env gives exit 2
- the retry budget stops retrying
- a long healthy sweep keeps its retry
- outage + UNKNOWN gives NOT JUDGED, not exit 2
- a short list gives exit 2
- an unchanged status is not re-posted
- a publish outage gives STATUS NOT PUBLISHED
- a 401 is not retried (exit 2)
- an `errors` body is not retried (exit 2)
- 3 pages: cursors `null,c3,c6`, PRs judged 1..7 in order
- an overlapping page judges each PR once
- only the UNKNOWN PR is re-polled
- a conflict on page 2 gives exit 1
- a judged conflict plus a lost batch gives exit 1, with no call after the outage

**Red against the UNFIXED script (origin/main 8d82d61): 7 of the first 11
cases failed.** Examples: one 504 then 200 gave exit `2/1 call`; 504 x3 never
said GITHUB-OUTAGE; the paging cursor was `undefined`. The other 4 pinned
behaviour the old code already had, and the mutants below prove them.

Mutants (all 20 killed; a survivor would be a test defect):

- drop the retry
- retry a 401
- network error not retried
- unfetched PR treated as OK
- unjudged PRs not named
- outage passes as success
- stop after page 1
- cursor not passed
- no dedupe across pages
- keep fetching after an outage (it survived the first draft; the case was tightened)
- poll re-reads the whole board
- poll never runs
- strict env ignored
- conflict outranked by outage
- no retry budget
- budget as wall clock
- outage leaves UNKNOWN judged
- short list accepted
- unchanged status re-posted
- publish outage counted as a publish error

## Per-job CI table (local runs)

All rows ran on the first draft. After the review fixes (which touched only
`check-pr-mergeable.mjs`) I re-ran these: the self-test (55/55),
`check:script-conventions`, `prove:entry-point` (self-test and sweep) and
`npm run lint` (22/22).

| Job / step | Command | Result |
|---|---|---|
| architecture-guard: integrity | `bash bin/check-integrity.sh` | pass |
| architecture-guard: legacy tables | `npm run check:legacy-tables` | pass |
| architecture-guard: legacy program RPCs | `npm run check:legacy-program-rpcs` | pass |
| architecture-guard: lint:architecture | `npm run lint:architecture` | pass |
| architecture-guard: images | `AUDIT_STRICT=1 npm run check:images` | pass |
| architecture-guard: image widths | `check:image-widths:self-test` + `check:image-widths` | pass |
| architecture-guard: artifact policy | `check:workflow-artifact-policy` (self-test + run) | pass |
| architecture-guard: plan hygiene | `check:plan-hygiene:self-test` | pass |
| architecture-guard: mojibake | `check:mojibake:self-test` | pass |
| architecture-guard: entry point | `prove:entry-point:self-test` + `prove:entry-point` | pass |
| architecture-guard: going legacy RPCs | self-test + `check:going-legacy-rpcs` | pass |
| workflow-lint: docs-only | `node scripts/ci/docs-only.mjs --self-test` | pass |
| workflow-lint: masking | `node scripts/lint-workflow-masking.mjs` | pass |
| workflow-lint: notification | `lint-workflow-notification.mjs` (self-test + run) | pass |
| workflow-lint: preview prefixes | `check-no-preview-prefixes.mjs` (self-test + run) | pass |
| typecheck: rpc typing | `npm run check:rpc-typing` | pass |
| typecheck: wallclock brand | `npm run check:wallclock-brand` | pass |
| unit-tests: dancer-area isolation | self-test + `check:dancer-area-isolation` | pass |
| pr-mergeable-guard: self-test | `npm run check:pr-mergeable:self-test` | pass (55/55) |
| script conventions | `npm run check:script-conventions` | pass (R5 entry retired) |
| lint chain | `npm run lint` | pass, 22/22, after CI's `chmod +x bin/*.sh`. Without it `check:integrity` exits 126 in this sandbox, a file-mode artifact of the checkout |
| unit-tests: offline | `npm run test:unit:offline` | 580/581 files; **5 failures, all in `tests/integrityCouldNotRun.test.ts`, identical on unmodified main** (sandbox: TypeScript resolves in the temp repo, "precondition gone"). Not this PR |
| live sweep, read-only | `node scripts/check-pr-mergeable.mjs` | sandbox token is a placeholder: HTTP 401, answered once, exit 2 in 0.19 s (the no-retry branch, against the real API) |

## Verified on real data
- Shapes surveyed: the live board, read-only through the GitHub connector: 136 open PRs (REST list, 100 + 36) and the job log of the failing run 40121097694 (sweep started 18:31:42.77, HTTP 504 at 18:31:53.87 = 11.1 s; canary green); the last 8 guard runs on main all red. No database shapes apply: this PR touches no app code and no SQL.
- Checks run: the self-test, 55 cases (18 new), driving main() against a fake GitHub that serves 504, network error, 401, errors body, 3 pages, overlap, UNKNOWN re-poll, budget, short list, publish skip, publish outage and a conflict on page 2. Red-first against the unfixed script (7 of 11 failed). 20 mutants, 20 killed. The architecture-guard, workflow-lint, typecheck and unit-tests job steps and `npm run lint`, run locally (table above). One xhigh review round, 12 of 14 findings fixed.
- NOT verified: the new sweep against the real repo. This sandbox has no usable GitHub token (`GITHUB_TOKEN` / `gh auth token` are a proxy placeholder; GraphQL answers 401 / 403), and `gh api` is off-limits. So the after-timing and the per-PR verdict count are NOT measured. The first hourly run after merge (cron `17 * * * *`) is the real proof. Check its "Sweep open PRs" step for 2 list calls and 7 detail calls, no 504, a verdict line for every open PR, and mostly `unchanged` instead of `published` on the second run.

## Phone QA
- Not applicable: no visible change
