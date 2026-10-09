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
- Never merge or approve. Leave merging to the owner (batched).
```
