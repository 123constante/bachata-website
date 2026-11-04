# Brief: stop docs-only merges to main from creating a Vercel deployment at all, Opus

Branch `claude/vercel-docs-only-no-deploy-1` (create from main; push ONLY here; push early with [skip preview], final push without it; final subject ends `[worker-done <ticket>]`). Careful lane (hard-tier: scripts/, vercel.json, workflows). Under 30% context.

## What main lacks
Measured 2026-11-04 on the Vercel API (project prj_KVXvwOmB4SDFy3HljJqXVgiq6APq, team team_Id0gAANQpZgZF457VMkqjiRy; VERCEL_TOKEN is in the environment, read-only use): in 24 h there were 40 production deployments from merges to main, 22 READY and 18 CANCELED. The 18 are merges that `scripts/vercel-ignore-build.sh` skipped (docs/test/CI-only) with exit 0; Vercel still CREATES a deployment, marks it CANCELED, and it counts toward the ~100 deployments per rolling 24 h cap. #1338 already stopped brief/*, tmp-* and dependabot/* by `vercel.json` git.deploymentEnabled, so those never create a deployment.

## Do
1. Find, from Vercel's documentation and from evidence on the API, whether ANY mechanism stops a push to main being turned into a deployment at all when the commit is docs-only: commit-message directives (for example `[skip ci]`, `[ci skip]`, `[vercel skip]`), a Git-integration setting, a GitHub-side condition. Do not assume; cite the page and quote the rule. Use the Vercel API read-only to look for past deployments from commits whose message carried such a tag, and show whether a deployment was created.
2. If a mechanism exists and is safe: implement it where merges are made (the squash-merge title/body convention used by the merge tools, documented in `docs/pr-batching-policy.md`) and/or in config, with a test or guard that cannot be silently bypassed for a commit that changes app code (a code change must always still deploy). Show the rule that decides "docs-only" is the SAME one `vercel-ignore-build.sh` uses (one shared definition, not two copies).
3. If no safe mechanism exists, write that conclusion with the evidence in `docs/pr-batching-policy.md` (short), change nothing else, and say so in the PR body.
4. Prove with a real docs-only merge is NOT possible from a worker: say so under Not verified; give the exact one-line check the lead can run after a docs-only merge (Vercel API deployment count before/after).
5. Run every CI step that applies, fill the PR body (Verified on real data / Not verified), hard-tier: owner Approve at head.
