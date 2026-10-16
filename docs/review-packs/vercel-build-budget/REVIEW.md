# Review: Vercel build budget (PR #802, `claude/vercel-build-budget` @ `4d66f73b`)

Independent, read-only review. Brief: `briefs/review-vercel-build-budget.md` on
`arc/briefs-dancer-rebuild` (sha 224bc86c). Reviewer did not write the code; no
code fixes were made. Ticket dt_0080853d9350.

## Question 1: does an ignored (CANCELED) build count toward the Hobby deployment limit?

**Answer: YES, it counts.** So the ignore step alone does NOT give back the
100/day headroom. It only saves build minutes. `vercel.json`
`git.deploymentEnabled` is needed as well.

Evidence. Vercel's Project settings docs (Ignored Build Step section), as
quoted by search-engine snapshots of the page and in a Vercel community thread:

> "Canceled builds are counted as full deployments as they execute a build
> command in the build step. This means that any canceled builds initiated using
> the ignore build step will still count towards your deployment quotas and
> concurrent build slots."
> https://vercel.com/docs/project-configuration/project-settings (Ignored Build Step)
> quoted at https://community.vercel.com/t/do-cancelled-builds-count-towards-the-deployment-limits-count/3747

Also https://vercel.com/docs/builds (per search snapshot): the ignored build step
"still counts toward your concurrent build limits".

**Caveat, stated honestly:** vercel.com was NOT reachable from this worker
(WebFetch: `getaddrinfo ENOTFOUND vercel.com`; curl through the proxy:
`CONNECT tunnel failed, response 403`). The sentence above comes from two web
search passes: search-engine snapshots of the Vercel docs page, plus the
community thread that quotes it word for word. I could not open the live page
to re-quote it. The owner can confirm in 10 seconds by opening that URL.

`git.deploymentEnabled` with globs is official. The Vercel changelog "Granular
branch matching for Git configuration in vercel.json"
(https://vercel.com/changelog/granular-branch-matching-for-git-configuration-in-vercel-json)
shows `"internal-*": false` preventing deployments for branches that start with
`internal-`. Keys are minimatch patterns, and `*` does not cross `/`. That
does not matter here because every `*` comes after the slash. A branch that
matches no key still deploys. A branch deploys if ANY matching key is `true`.

**Recommended fix (owner's call, it touches `vercel.json`, which is never
automergeable):**

```json
"git": {
  "deploymentEnabled": {
    "arc/briefs-*": false,
    "claude/done-*": false,
    "claude/review-*": false
  }
}
```

Keep the `ALWAYS_SKIP_PREFIXES` shell branch as defence in depth. It costs
nothing, and it still catches the case where someone removes the json key.
`[skip preview]` CANNOT be expressed in `deploymentEnabled`, which only matches
branch names. See finding S1.

## Findings (ranked)

### BLOCKER

**B1. PR #802 conflicts with `main`, so its `pull_request` gates will not run.**
`scripts/pre-ship.mjs:287-288` and `scripts/run-lint-chain.mjs:146-147`. Main
added `check:journey-grid:self-test` and `check:journey-grid` at the same
anchor, so `git merge origin/main` stops with conflicts in both files. Per
CLAUDE.md ("the conflicting-PR trap"), a conflicting PR's `pull_request`
workflows never queue.
Fix: merge `origin/main` into the branch and keep BOTH pairs of lines in each
array (union, journey-grid first or second, order is irrelevant). Trial merge
with that resolution: `src/modules/organiser/dates`, both touched test files and
the guard are all green (236/236 tests, guard 0 drift).

### SHOULD

**S1. `[skip preview]` saves no rate-limit headroom.**
`scripts/vercel-ignore-build.sh:116`, `docs/pr-batching-policy.md:54-57`.
Q1 says an ignored build still counts as a deployment. A tagged checkpoint push
therefore still uses one of the ~100/day slots. The policy doc presents it as
budget relief. What actually saves a slot is NOT pushing the checkpoint: the
"push once" rule already in the dispatch prompt.
Fix: keep the code, since it still saves minutes and concurrency. Reword the
policy bullet to: "`[skip preview]` saves build minutes and a concurrent build
slot, NOT a deployment; the 100/day budget is only saved by not pushing."

**S2. The drift guard finds preview jobs by a run-string allowlist, so a sixth
preview job that reaches `resolvePreviewUrl` through another script is missed.**
`scripts/check-no-preview-prefixes.mjs:41-42`. Mutant M2 below shows a new job
`run: npm run check:new-preview-thing`, with no exclusions, passing green. The
same happens for a reusable workflow (`uses:`, mutant M4). Today the probe is
only called through `resolve-preview-url.mjs`, `check-lighthouse.mjs` and
`check-doc-weight.mjs`, so nothing slips through yet.
Fix (pick one):
- (a) Derive `PREVIEW_RUN` from the importers: scan `scripts/**/*.mjs` for
  `resolvePreviewUrl` and match any `run:` that names one of those files or the
  `npm run` aliases that point at them (read `package.json` scripts).
- (b) Cheaper: fail when any job whose `if:` mentions `github.event_name ==
  'pull_request'` and has a `!startsWith(github.head_ref,` exclusion is not
  classified as a preview job. This is weaker.

**S3. A future PR from a no-preview branch that changes `src/` gets no preview
gates.** The handover already raises this as an owner's call. I agree it is
acceptable only while these prefixes stay docs-only by convention. There is
no guard on that convention.
Fix (cheap): have `automerge-classify` or a tiny check refuse a PR from
`arc/briefs-*`, `claude/done-*` or `claude/review-*` that touches `src/`, `app/`
or `api/`. Not needed for this PR.

### NIT

**N1.** `scripts/vercel-ignore-build.sh:116` matches the tag anywhere in the
subject, not only at its end. A subject like "docs: explain the [skip preview]
tag" on a feature branch loses its preview, and its preview jobs then fail
RED. That is fast and loud, so it is safe.
Fix (optional): `*"$SKIP_PREVIEW_TAG")` (suffix match), mirrored with
`endsWith` in `previewProbe.mjs`.

**N2.** The handover's "Left" notes that the preview jobs install dependencies
before the fast fail. That costs CI minutes on a checkpoint head. It is a
follow-up and does not block.

## Q2: correctness of `scripts/vercel-ignore-build.sh`. OK

- Production: the whole budget block sits inside `if [ "${VERCEL_ENV:-}" !=
  production ]` (`:105`), so production behaviour is unchanged (the existing diff
  rule). Mutant T2 (`if true`) makes 2 production rows go red.
- Unknowns build: unset `VERCEL_GIT_COMMIT_REF` or message, a missing base, a
  shallow base and git errors all reach `build`. Any crash exits non-zero/non-0
  (it is still exit 1 or 2), which means BUILD.
- Subject-only: `${msg%%"$nl"*}` is POSIX. Mutant T1 (match the whole message)
  makes the body row go red.
- No bashisms: `dash -n` and `bash -n` both pass. The full 44-row suite passes
  with `sh` = dash (default here) and with `sh` = bash (via a PATH shim). The
  Vercel build image's `sh` is bash. Prefixes are anchored (`"$p"*`), and a
  row covers `claude/fix-review-*`.
- Not verifiable: whether Vercel exposes `VERCEL_GIT_COMMIT_MESSAGE` to the
  ignore step (docs unreachable). If it is missing, the result is a build
  (fail-safe), and previewProbe's one-pass check still uses the real preview.

## Q3: preview jobs' `if:`. OK

All five (`perf-budget.yml:114` lighthouse, `:148` doc-weight,
`synthetic-ssr-monitor.yml:185`, `seo-check.yml:143`, `og-image-check.yml:226`)
are `pull_request && !startsWith(head_ref, X)` for the five prefixes. A normal
`claude/<task>` head_ref matches none of them, so the jobs run as before. On a
skipped branch, a job whose `if:` is false reports **Skipped**, and GitHub
counts that as passing for a required check, so nothing stays pending forever.
Not verified: the actual `main` ruleset's required-check list (needs `gh api`,
which is forbidden). One risk only if the owner applies the Q1 fix: if the
**Vercel** commit status is a required check, `deploymentEnabled: false`
branches post no Vercel status, and their PRs would wait forever. Check the
ruleset before adding the json key. Today's ignore-step skip does post a
status.

## Q4: mutation results

Guard `check-no-preview-prefixes.mjs` (baseline: 5 jobs compared, 0 drift, exit 0; self-test 17/17):

| # | Mutant | Exit | Caught? |
|---|---|---|---|
| M1 | drop `claude/review-` from `seo-preview` `if:` | 1 (`missing [claude/review-]`) | yes |
| M2 | sixth job, no exclusions, `run: npm run check:new-preview-thing` | 0 | **no** (S2) |
| M3 | sixth job, only `bot/`, `run: URL=$(node scripts/resolve-preview-url.mjs)` | 1 | yes |
| M4 | sixth job, no exclusions, `uses: ./.github/workflows/preview-reusable.yml` | 0 | **no** (S2) |

Tests, with the guarded code reverted:

| # | Revert | Result |
|---|---|---|
| T1 | `vercel-ignore-build.sh:116`: `case $msg in` (whole message) | 1 failed ("[skip preview] only in the commit BODY builds") |
| T2 | `vercel-ignore-build.sh:105`: `if true; then` (drop the production guard) | 2 failed (production rows) |
| T3 | `previewProbe.mjs`: subject `split('\n')[0]` changed to `trim()` | 1 failed (tests/previewProbe.test.ts) |

Every mutant was restored with `git checkout`, and the tree was clean afterwards.

## Q5: CI job steps this diff touches, run locally

| Workflow / job | Step (command) | Exit |
|---|---|---|
| workflow-lint / bom-check | BOM scan of `.github/workflows/*.yml` (`od` instead of `xxd`, which is not installed) | 0 (none) |
| workflow-lint / masking-check | `node scripts/lint-workflow-masking.mjs` | 0 |
| workflow-lint / notification-check | `node scripts/lint-workflow-notification.mjs --self-test` | 0 |
| | `node scripts/lint-workflow-notification.mjs` | 0 |
| | `node scripts/check-no-preview-prefixes.mjs --self-test` | 0 (17/17) |
| | `node scripts/check-no-preview-prefixes.mjs` | 0 |
| (lint chain / pre-ship links) | `node scripts/prove-entry-point-dispatch.mjs` | 0 |
| | `node scripts/check-script-conventions.mjs` | 0 |
| unit-tests / full | `npm run test:unit` (branch as is) | 1: 59 failed / 6 files |
| | `npm run test:unit:timing` | 0 |
| | touched files only: `vitest run tests/vercelIgnoreBuild.test.ts tests/previewProbe.test.ts` | 0 (74/74) |
| perf-budget lighthouse, doc-weight; synthetic-ssr-monitor; seo-check; og-image-check | only the `if:` changed; they need a live Vercel preview | not runnable here |

The 59 unit failures are not this PR's:
- 44 are in `src/modules/organiser/dates/__tests__` (date drift). Main fixed them
  in #784, which the branch does not have (base `bc43fb6`). They pass after a
  trial merge of main.
- 15 are in 4 contract/integrity files (`eventViewCompat`, `integrityCouldNotRun`,
  `occurrenceProgram`, `publicEventPageLineup`). They fail identically on
  `origin/main` in this container (live-DB / temp-repo environment).

## Could not check

- Live Vercel docs (DNS/proxy blocked). The Q1 quote comes from search snapshots
  and a community thread. Re-open the URL to confirm.
- Real Vercel behaviour: no `VERCEL_TOKEN` was used. The skip log line, whether
  `VERCEL_GIT_COMMIT_MESSAGE` reaches the ignore step, and Instant Rollback on
  Hobby all need a merge and a real push.
- The `main` ruleset's required checks (no `gh api`).
- PR #802's current check runs (not read).
