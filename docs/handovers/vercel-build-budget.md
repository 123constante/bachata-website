# Handover: vercel-build-budget

Brief: `briefs/vercel-build-budget.md` on `arc/briefs-dancer-rebuild`
(sha b13ab09e43835fc573e665e817d8437833aa6c50). Branch `claude/vercel-build-budget`.

## Done

- `scripts/vercel-ignore-build.sh`: NON-production builds now SKIP before the
  diff rule when the branch starts with `arc/briefs-`, `claude/done-` or
  `claude/review-` (`ALWAYS_SKIP_PREFIXES`), or the commit SUBJECT ends with
  `[skip preview]` (end-only since the fix pass) (`SKIP_PREVIEW_TAG`). `bot/` and `dependabot/`
  (`DIFF_RULE_PREFIXES`) keep the diff rule. Production unchanged; every
  unknown still builds.
- One source of truth: those two shell lines. The five preview jobs (perf-budget
  lighthouse + doc-weight, synthetic-ssr-monitor, seo-check, og-image-check)
  copy the union in their `if:`.
- `scripts/check-no-preview-prefixes.mjs` (+ `--self-test`, 17 cases): parses
  every workflow as YAML, finds preview jobs by what they RUN, fails on any
  prefix drift and on `SKIP_PREVIEW_TAG` drift between the script and
  `previewProbe.mjs`. Wired into `workflow-lint.yml` (notification-check job,
  which runs `npm ci`), `npm run lint` and `pre-ship`. Mutant proof: dropping
  `claude/review-` from perf-budget's doc-weight job exits 1; restored exits 0.
- `scripts/lib/previewProbe.mjs`: a `[skip preview]` subject throws in one pass
  ("checkpoint commit: no preview by design; the final worker push builds
  one"), RED, unless a ready preview exists for that head anyway.
- `docs/pr-batching-policy.md`: "Vercel build budget" section + worker
  checklist line.
- Tests: `tests/vercelIgnoreBuild.test.ts` (+20 rows), `tests/previewProbe.test.ts`
  (+6 cases). Red first against the unchanged code (6 + 2 failures), then green.

## Left / for the owner

- Not verified: real Vercel skip behaviour (needs a merge to main, then a push
  on an `arc/briefs-*` branch and a `[skip preview]` commit), and Instant
  Rollback on Hobby.
- Review finding, owner's call: if CANCELED (ignored) deployments count toward
  the Hobby 100/day limit, this saves no rate-limit headroom.
  `vercel.json` `git.deploymentEnabled` per branch glob would stop the
  deployment being created at all. Not done: the brief fixed the ignore step as
  the mechanism.
- Review finding, owner's call: a PR from an `ALWAYS_SKIP_PREFIXES` branch that
  changes `src/` gets no preview gates at all (the jobs are SKIPPED, which
  satisfies required checks). The brief chose unconditional skip for these
  prefixes.
- The preview jobs install dependencies before `resolve-preview-url` runs, so a
  checkpoint head still pays the install minutes before the fast fail. Moving
  the resolve step first is a follow-up, not done here.
- A dashboard Redeploy of a skipped head is skipped again; push an untagged
  commit instead.

## Next steps

1. Owner reviews and merges the PR (workers never merge).
2. After merge, watch the Vercel log for `vercel-ignore-build: SKIP -- branch
   'arc/briefs-...'` on the next brief push.
3. Paste the checklist line into worker prompts: checkpoint subjects end with
   `[skip preview]`, never the final `[worker-done]` push.

## Fix pass (review `docs/review-packs/vercel-build-budget/REVIEW.md`, brief `briefs/fix-vercel-build-budget.md` sha 50b20a9e)

### Done
- **B1** merged `origin/main`; `scripts/pre-ship.mjs` and `scripts/run-lint-chain.mjs`
  keep BOTH the no-preview-prefixes and the journey-grid links.
- **Q1 (orchestrator: YES, an ignored build counts)** `vercel.json` gains
  `git.deploymentEnabled` with `arc/briefs-*`, `claude/done-*`, `claude/review-*` = false.
  The shell `ALWAYS_SKIP_PREFIXES` stays (defence in depth).
  `check-no-preview-prefixes.mjs` now fails when the `false` keys differ from
  `ALWAYS_SKIP_PREFIXES` + `*` (missing, extra, or set to `true`; no `git` key = all missing;
  unparseable JSON = exit 2).
- **S1** policy bullet reworded: `[skip preview]` saves build minutes and a concurrent build
  slot, NOT a deployment; the 100/day budget is only saved by not pushing.
- **S2 (fix a)** preview jobs are now found by DERIVED preview scripts: every `scripts/**/*.mjs`
  that IMPORTS `resolvePreviewUrl` (probe, guard and `__tests__` excepted), closed over
  "imports one of them" (import specifiers only, never comments), plus every package.json
  alias whose command names one by basename or runs another such alias. A `run:` matches by
  basename or `npm run [flags] <alias>` (`npm run -s x` counts). The hard-coded `PREVIEW_RUN`
  regex is gone. Today it derives check-doc-weight, check-lighthouse, resolve-preview-url
  and aliases check:doc-weight, check:lighthouse; 5 jobs compared, 0 drift.
- **N1** the tag matches only at the END of the subject (`*"$SKIP_PREVIEW_TAG")` in the
  shell, `endsWith` in previewProbe).
- Self-test 17 -> 30 cases. Fix-pass /code-review (high) findings applied: alias chains,
  `npm run -s`, basename runs, import-only seeding, exec bit restored on the ignore script,
  stale header comments, one shell-list parser.

### Red-first and mutants
| Proof | Result |
|---|---|
| 2 new N1 tests vs unfixed code | 2 failed / 74 passed; after fix 76/76 |
| Real `vercel.json` minus `claude/review-*` | exit 1 (`missing [claude/review-*]`); restored exit 0 |
| Real `vercel.json` `arc/briefs-*: true` | exit 1; restored |
| Review mutant M2 (new script importing resolvePreviewUrl, alias `check:new-preview-thing`, job without exclusions) | new guard exit 1; OLD guard (branch head 4d66f73) exit 0 |
| Guard mutant: vercel comparison `if (false)` | self-test 4/30 FAIL (the 4 vercel rows); rolled back |
| Guard mutant: derivation ignores the new script | self-test 1 FAIL (S2 row); rolled back |
| Guard mutant: alias chains not followed | self-test 1/30 FAIL (alias-chain row); rolled back |

### Left
- **S3 (not built, CI step > budget):** only a doc line was added (policy doc: these prefixes
  are docs-only by convention; automerge already refuses `src/`, `app/`, `api/` on any branch).
  Proposal: a `pull_request` step in `workflow-lint.yml` with `actions/checkout` `fetch-depth: 2`
  (the PR merge commit), `git diff --name-only HEAD^1 HEAD`, failing when `github.head_ref`
  starts with an `ALWAYS_SKIP_PREFIXES` entry and a path is under `src/`, `app/` or `api/`;
  a `--pr-scope` mode of `check-no-preview-prefixes.mjs` reading the prefixes from the script.
- **N2 (follow-up):** preview jobs still run `npm ci` before the fast fail. The `pull_request`
  payload carries no commit message, so moving the check first needs a tiny curl/no-deps step
  before install in each of the 5 jobs.
- **S2 gaps (documented in the guard header):** a job reaching the probe through `uses:`
  (reusable workflow, review mutant M4), a `.sh`, or `node -e` is still not found.
- **Brief/review/done branches must merge `main` after this lands.** Vercel reads
  `vercel.json` and the ignore script from the PUSHED commit, and
  `arc/briefs-dancer-rebuild` does not contain main (77 ahead, 9 behind at review
  time). Until each such branch merges main, its pushes still deploy and count.
- Vercel's `*` does not cross `/`: `claude/review-a/b` would still create a
  deployment (the shell then skips the build). Keep names slash-free after the prefix.
- Review of the fix pass (/code-review high) also suggested moving the prefix check
  into previewProbe at runtime so the five `if:` copies disappear: a redesign, not done.
- `bin/check-integrity.sh` is mode 100644 on main, so `npm run lint`'s
  `check:integrity` link exits 126 here (passes via `bash`, exit 0). Pre-existing, not this PR.
- **Owner, before merge:** if the `main` ruleset REQUIRES the Vercel commit status, PRs from
  the three disabled prefixes will wait forever (no deployment, no status). Not checkable
  here (no `gh api`).
- Not verified: live Vercel behaviour of `deploymentEnabled` and the ignore step (needs a
  merge and a real push); the Vercel docs quote comes from the review's search snapshots.

### Next
1. Owner checks the ruleset's required checks, then reviews/merges PR #802.
2. After merge, push to an `arc/briefs-*` branch: no Vercel deployment should appear at all.
