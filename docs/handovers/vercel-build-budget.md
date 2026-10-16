# Handover: vercel-build-budget

Brief: `briefs/vercel-build-budget.md` on `arc/briefs-dancer-rebuild`
(sha b13ab09e43835fc573e665e817d8437833aa6c50). Branch `claude/vercel-build-budget`.

## Done

- `scripts/vercel-ignore-build.sh`: NON-production builds now SKIP before the
  diff rule when the branch starts with `arc/briefs-`, `claude/done-` or
  `claude/review-` (`ALWAYS_SKIP_PREFIXES`), or the commit SUBJECT carries
  `[skip preview]` (`SKIP_PREVIEW_TAG`). `bot/` and `dependabot/`
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
