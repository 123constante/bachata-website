# Vercel deploy budget: scope (read-only, no brief yet). website-18, 2026-11-04

Question (website-44, owner "option 7"): the Hobby cap is ~100 deployments per rolling 24 h and we are at 93. What uses it, which PR checks really need a preview, and how do we cut main builds?
Sources: `vercel.json`, `scripts/vercel-ignore-build.sh`, `docs/pr-batching-policy.md`, the five preview workflows on origin/main (2b8831448), and one read-only call to the Vercel deployments API (window 2026-11-03 12:36Z to now). Nothing was changed.

## What the 93 are (measured)

| Count | Target | State | Branch |
|---|---|---|---|
| 49 | preview | CANCELED | `brief/*` |
| 18 | production | CANCELED | `main` |
| 17 | production | READY | `main` |
| 5 | preview | 4 CANCELED, 1 READY | `tmp-*` (probe branches that pushed) |
| 2 | preview | READY | `dependabot/*` |
| 2 | preview | READY | CLI (`preview-deploy.mjs` walks) |

71 are CANCELED (the ignore script skipped them) and 22 are READY. Only the 22 used build minutes; the cap counts all 93.
Do cancelled deploys count? Our own counter (`vercel-budget.mjs`) counts them, and `docs/pr-batching-policy.md` quotes Vercel's Ignored Build Step docs: "canceled builds ... will still count towards your deployment quotas". NOT verified by me against a real refusal; 2026-10-16 hit the wall at 93 with ignored builds in the count, which agrees but does not prove it.

## (1) Which PR checks need a preview, and how a `claude/*` PR gets one

None needs one. `claude/*` PRs get NO Vercel preview (`vercel.json` `claude/*: false`, `arc/briefs-*: false`) and every preview job is excluded for them by an `if:` on the head ref (`bot/`, `dependabot/`, `arc/briefs-`, `claude/`):

| Check | Workflow job | Preview use | `claude/*` PR |
|---|---|---|---|
| Lighthouse, doc-weight | `perf-budget.yml` | `previewProbe.resolvePreviewUrl` (GitHub Deployments API for the head sha, bypass secret) | skipped, `no-preview-reason` job says why |
| Synthetic SSR | `synthetic-ssr-monitor.yml` (PR job) | same | skipped |
| SEO preview | `seo-check.yml` (PR job) | same | skipped |
| OG preview | `og-image-check.yml` (PR job) | same | skipped |
| Phone QA | `phone-qa.yml` | none: a local build with a fake Supabase | runs |
| Everything else (unit, e2e-smoke, lint chain, db-contract) | | none | runs |

The real preview gates run only for `main`, `feat/*` and PRs from `feat/*`. The "2 cli" deploys are the orchestrator's walks: `preview-deploy.mjs <branch>` (CLI upload, refuses at 85/100, about 1 deploy per walked PR). They are the only way a `claude/*` PR gets a preview, and they are on demand.
`previewProbe` for a head that never built: applies the same BUILD_PATHS rule and measures a previewed ancestor, else polls 600 s and THROWS; a `[skip preview]` head fails fast and red.

## (2) What a merge to `main` costs

Every merge is one push, and Vercel creates one production deployment per push. `ignoreCommand` runs AFTER the deployment exists, so the 18 docs/ci/test-only merges were CANCELED but each still took one slot. 35 merges in 24 h = 35 slots: 17 real builds + 18 slots for nothing.
Nothing in `vercel.json` can stop production deployments being created for `main`: `main: true` must stay.

## (3) Options, biggest first

A. **Turn off the junk branch prefixes at the source** (website-44 is already on this). Saves about 56 of 93 (49 `brief/` + 5 `tmp-` + 2 `dependabot/`); would have left 37. Do it as ONE PR, because a guard compares the lists:
 - `vercel.json` `git.deploymentEnabled`: add `"brief/*": false`, `"tmp-*": false`, `"dependabot/*": false`.
 - `scripts/vercel-ignore-build.sh`: `ALWAYS_SKIP_PREFIXES` gets `brief/ tmp-` and `dependabot/` MOVES there from `DIFF_RULE_PREFIXES` (the check compares the `false` keys with `ALWAYS_SKIP_PREFIXES`, each key = prefix + `*`).
 - The `if:` exclusion lists in `perf-budget.yml` (2 jobs), `synthetic-ssr-monitor.yml`, `seo-check.yml`, `og-image-check.yml` and their `no-preview-reason` jobs: add the same prefixes, or `npm run check:no-preview-prefixes` (in `workflow-lint.yml`) goes red.
 - Cost of `dependabot/*` off: its preview jobs are already excluded, so nothing is lost. A branch with deployments off posts no Vercel commit status: confirm the `main` ruleset does not require it (the policy doc warns about this).
 - `*` does not cross `/`: `brief/foo` matches `brief/*`; `brief/a/b` would not. land-brief names are flat.
 - Probes that push: use a `claude/` name (off already). The `tmp-merge-probe-*` names come from no script in `~/.claude/bin`; I did not find the source.
B. **Fewer docs-only merges to `main`** (18 of 35 today). Each is one slot whatever the skip rule says; the only saving is merging fewer commits. Rule 2 of the batching policy already says docs ride with the feature PR. For docs that must land alone (review docs like #1335, handovers): a rolling `docs/batch` branch merged once a day turns about 15 slots into 1. Needs a decision on who owns the batch branch and a conflict story (docs files rarely collide). Tooling effect: `land-brief` branches never merge and cost nothing once A is in.
C. **Batch code merges.** 17 real builds. Merging several PRs "in one sitting" still makes one push each; Vercel builds each tip (not verified whether a later push within seconds supersedes an in-flight build). A real saving needs fewer pushes: merge a `feat/*` integration branch (one squash = one slot), which the policy already calls the way to get previews.
D. **Take production deploys off the Git integration** (`main: false`) and run `vercel deploy --prod` from a workflow only when BUILD_PATHS changed. Saves the other 18 slots and any later docs slots (CLI deploys count only when run). Secrets exist (`VERCEL_TOKEN`, `VERCEL_DEPLOY_HOOK_URL`). Costs and risks: this is production deploy plumbing (careful lane, hard tier); the workflows that fire on Vercel's `deployment_status` (`cloudflare-purge-on-deploy.yml`, the production arms of `seo-check.yml` and `og-image-check.yml`) would stop firing unless the CLI deploy creates a GitHub deployment status or they move to `workflow_run`; rollback and `main` health need a plan. Not recommended before A and B show what is left.

Recommended order: A now (one PR, about 56 slots a day), B next (about 15), C as a habit, D only if the count is still over 85 after A and B.

## Not verified

- Whether a CANCELED deployment is counted by Vercel's own limiter (documented, not proven here).
- Whether two pushes seconds apart cause Vercel to skip or supersede the first build.
- Whether the `main` ruleset requires a Vercel status check (needed before A adds `dependabot/*`).
- The 24-hour window will differ tomorrow: re-run the breakdown after A lands (script: read-only call to `/v6/deployments?since=...`, grouped by target, state and branch prefix).
