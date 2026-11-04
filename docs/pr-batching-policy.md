# PR batching policy

Why this exists: the owner measured 160 merged Website PRs in 30 days (31 on
the busiest day). Every merge to Website `main` triggers a production Vercel
deploy on the Hobby plan, and 44 of the last 100 production deploys were
docs/ci/test/chore commits. Every branch push also builds a preview (19 pushes
to one PR branch made 19 previews in a day). Fewer, bigger PRs and fewer
pushes is the whole goal.

**Target: at most 5 merged Website PRs per day, averaged over a week.**

## Rules

1. **One branch and one PR per unit of work.**
   Why: a unit of work then costs one preview and one production deploy, not several.
2. **Docs, CI, test and chore changes ride with the feature PR they belong to.**
   They are never a standalone PR unless nothing else is open.
   Why: a standalone docs PR costs a full production deploy for no user-visible change.
3. **A worker fixes its own mistakes on its own branch.**
   A follow-up PR is only for a defect found after merge.
   Why: a fix-up PR doubles the deploys for one unit of work.
4. **Push once, when the work is finished.**
   Iterate with a local build and local tests.
   Why: each push is a preview build.
5. **Keep draft PRs unpushed until there is something to look at.**
   Why: an early draft push builds a preview nobody opens.
6. **Never push to a branch with an open PR just to re-run CI.**
   No empty commits, no close and reopen.
   Why: it burns a preview build and proves nothing new.
7. **Batch merges to `main`.**
   The owner merges a group of ready PRs in one sitting, in a deliberate order.
   Why: merging in one sitting lets the deploy skip rule and the queue absorb the
   burst, and the order avoids repeated conflict fixes (each fix is another push).
8. **Dependabot: group updates.**
   Why: one grouped PR replaces many single-package PRs.

## Vercel build budget

Vercel Hobby allows about 100 deployments per rolling 24 hours. On 2026-10-16
we made 93 and hit "Deployment rate limited - retry in 24 hours": no PR
previews, and a merge to `main` would not have deployed production either.
Over the 3 days before, docs-only brief branches alone were 36% of all builds.

The rule (`scripts/vercel-ignore-build.sh`, the `vercel.json` ignoreCommand),
for NON-production builds only:

- **No preview for these branch prefixes:** `arc/briefs-` and `claude/`
  always skip; `bot/` and `dependabot/` skip when no build path
  changed (as before). That list lives ONLY in the script
  (`ALWAYS_SKIP_PREFIXES` + `DIFF_RULE_PREFIXES`); the preview jobs' `if:` in
  `perf-budget.yml`, `synthetic-ssr-monitor.yml`, `seo-check.yml` and
  `og-image-check.yml` copy it, and `npm run check:no-preview-prefixes` (run in
  `workflow-lint.yml`) fails when a copy drifts.
- **`vercel.json` `git.deploymentEnabled` turns those always-skip
  prefixes off at the source** (`"arc/briefs-*": false`, ...). An ignored build
  still COUNTS toward the Hobby ~100/day deployment limit (Vercel docs, Ignored
  Build Step: "canceled builds ... will still count towards your deployment
  quotas"); a branch with deployments disabled creates no deployment at all.
  The script's `ALWAYS_SKIP_PREFIXES` stays as defence in depth, and
  `check:no-preview-prefixes` fails when the `false` keys differ from it (each
  key is the prefix plus `*`). Such a branch posts no Vercel commit status: if
  the `main` ruleset ever requires the Vercel status, its PRs would wait
  forever. Vercel reads `vercel.json` from the PUSHED commit, so a long-lived
  brief branch must merge `main` once before this takes effect there; and its
  `*` does not cross `/`, so keep those branch names slash-free after the prefix.
- **A preview exists ONLY for `main`, `feat/*` and PRs from `feat/*`** (VB2,
  2026-10-17). Every `claude/*` branch (worker slices, review and done-signal
  branches) and `arc/briefs-*` get no deployment: `vercel.json` has
  `"claude/*": false`, `"arc/briefs-*": false`, and the keep-on entries
  `"main": true`, `"feat/*": true`. Vercel deploys a branch when ANY matching key
  is `true` (a `true` always wins; unmatched branches deploy), so the guard
  allows no other `true` key: a stray glob such as `*-dev` would re-enable
  slices. `bot/*` and `dependabot/*` are unmatched and keep deploying (their
  preview jobs are skipped anyway; the diff rule still skips docs-only bot
  builds). Why: 117 deploys in 24 h on 2026-10-16, ~55 of them `claude/*` slice
  previews nobody opened.
- **A slice PR's evidence is the worker's sandbox table** (build, tests, every CI
  step run locally, browser walk), not a preview. On such a PR every preview job
  (lighthouse, doc-weight, synthetic SSR, seo-preview, og preview) is SKIPPED and
  a `no-preview-reason` job in each of those workflows writes why to the step
  summary. The real preview gates run when the slices land on the `feat/*`
  integration branch and its PR to `main`. Work that needs a preview opens from
  a `feat/<topic>` branch. `check:no-preview-prefixes` keeps the `false` keys,
  the `true` keys, the job exclusions and the reason jobs in step.
- **`arc/briefs-*` is docs-only by convention.** A PR from it that
  touches `src/`, `app/` or `api/` gets NO preview and its preview jobs report
  Skipped; open such work from a `feat/<topic>` branch instead. Automerge
  already refuses those paths on any branch; a CI check that reds such a PR is
  proposed (`docs/handovers/vercel-build-budget.md`), not built.
- **`[skip preview]` at the END of the commit SUBJECT skips the build** (the body is never read; the tag
  mid-subject does nothing). `[skip preview]` saves build minutes and a concurrent build slot, NOT a
  deployment; the 100/day budget is only saved by not pushing. Workers end every
  CHECKPOINT commit subject with `[skip preview]`, and NEVER put it on the final
  `[worker-done ...]` push: the final push must build the preview the PR checks
  need. A skipped build is CANCELED, so the next untagged push builds normally.
  The preview checks fail a `[skip preview]` head FAST and RED
  (`scripts/lib/previewProbe.mjs`: "checkpoint commit: no preview by design;
  the final worker push builds one"); a head that was never previewed never
  looks verified.
- Production (`main`, `VERCEL_ENV=production`) is unchanged, and every unknown
  case still builds.
- **A docs-only merge to `main` still CREATES a production deployment; no
  safe way to stop that was found (2026-11-04, ticket dt_4b0c72c66476).**
  Measured 2026-11-04 by the lead: 40 production deployments in 24 h, 18 of
  them CANCELED by this script (docs/test/CI-only merges). Each one counts
  toward the ~100/day cap (Vercel project settings docs, Ignored Build Step:
  canceled builds "still count towards your deployment quotas and concurrent
  build slots"). Every option checked:
  - *Commit-message directive* (`[skip ci]`, `[ci skip]`, `[vercel skip]`):
    no Vercel doc found that names one. `[skip ci]` is a GitHub Actions rule
    (GitHub docs, "Skipping workflow runs"), not a Vercel one, and Vercel's own
    community answer to "skip a build on a commit" is to read
    `VERCEL_GIT_COMMIT_MESSAGE` in the Ignored Build Step, which still counts.
    It would also be UNSAFE here: `[skip ci]` on a squash merge to `main` turns
    off every push-triggered workflow on `main` too.
  - *`git.deploymentEnabled`*: keyed by BRANCH only, never by commit or path;
    `"main": false` would stop production deploying at all.
  - *Vercel's automatic "skip unaffected projects"* (does not count, unlike
    the ignored step): monorepo-only, for a project whose Root Directory is
    not the repo root. This project builds from the repo root, so every
    commit "affects" it.
  - *GitHub-side*: the only route is turning off the Git integration for
    `main` and deploying production from a GitHub Actions job with a `paths`
    filter (`vercel deploy --prebuilt --prod`). That changes how production
    ships, so it is an owner decision, not a worker change.
  So `vercel.json` and the merge convention are unchanged; the cost of a
  docs-only merge is one CANCELED deployment, and the budget lever is still
  batching docs PRs (Rules above). **Not verified:** the worker's network
  blocked vercel.com and api.vercel.com, so the docs were read only through
  search results (sources: vercel.com/docs/project-configuration/project-settings,
  vercel.com/kb/guide/how-reduce-build-costs,
  community.vercel.com/t/is-there-a-way-to-skip-a-build-on-a-commit/8446),
  and the API was not queried for past tagged commits. Lead check (counts
  production deployments by state; run before and after a docs-only merge):
  `curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v6/deployments?projectId=prj_KVXvwOmB4SDFy3HljJqXVgiq6APq&teamId=team_Id0gAANQpZgZF457VMkqjiRy&target=production&limit=100" | jq '[.deployments[] | .state] | group_by(.) | map({(.[0]): length}) | add'`.
  Past commits that carried a skip tag: add
  `| select(.meta.githubCommitMessage | test("skip ci|ci skip|vercel skip"; "i"))`
  after `.deployments[]`; any hit means Vercel created a deployment anyway.

**Emergency path when rate-limited:** Vercel Instant Rollback to the previous
production deployment (dashboard: Deployments, pick the last good production
deployment, Instant Rollback). It reuses an existing build, so it should not
need a build slot. **Not verified on Hobby.**

## Proposal (not applied)

- Enable `groups:` in `.github/dependabot.yml` so minor and patch updates for
  each ecosystem arrive as one PR. This doc does not edit that file; the owner
  decides.

## Measuring

Merged Website PRs per day (change the date; run from a clone with `gh` authed):

```bash
gh pr list --repo 123constante/bachata-website --state merged \
  --search "merged:>=2026-10-01" --limit 500 \
  --json number,mergedAt --jq 'group_by(.mergedAt[0:10]) | map({day: .[0].mergedAt[0:10], merged: length})'
```

Production deploys by state (Vercel). In Git Bash on Windows, prefix with
`MSYS_NO_PATHCONV=1` so `/v6/...` is not rewritten into a Windows path:

```bash
MSYS_NO_PATHCONV=1 vercel api "/v6/deployments?target=production&limit=100" \
  | jq '.deployments | group_by(.state) | map({state: .[0].state, count: length})'
```

Check the endpoint and flags against `vercel api --help` before relying on the
numbers; the weekly average against the target above is what matters.

## Checklist to paste into worker prompts

```text
PR HYGIENE (docs/pr-batching-policy.md):
- One branch, one PR for this unit of work. Docs/CI/test/chore for it go in the same PR.
- Iterate locally (build + tests). Push ONCE when finished; no pushes to re-run CI.
- Fix your own mistakes on this branch. Follow-up PR only for a defect found after merge.
- No draft PR pushed until there is something to look at.
- Any checkpoint push: end the commit subject with [skip preview]. NEVER on the final [worker-done] push.
- claude/* branches get NO Vercel preview: your evidence is your sandbox table (every CI step run locally).
- Never merge or approve. Leave merging to the owner (batched).
```
