# Vercel: the rest of "no builds for brief/*, tmp-*, dependabot/*" (patch, not applied). website-18, 2026-11-04

For website-44's branch `claude/vercel-no-brief-builds-1`, which today changes only `vercel.json` (adds `"brief/*"`, `"tmp-*"`, `"dependabot/*"` as `false`). On its own that goes RED: `npm run check:no-preview-prefixes` (workflow-lint.yml) compares `vercel.json`'s `false` keys with `ALWAYS_SKIP_PREFIXES` in `scripts/vercel-ignore-build.sh`, and the preview jobs' `if:` lists with the union of `DIFF_RULE_PREFIXES` + `ALWAYS_SKIP_PREFIXES`. Base of every hunk below: origin/main 2b8831448 (the branch changes nothing else, so it applies cleanly).

## What the patch does

1. `scripts/vercel-ignore-build.sh`: `ALWAYS_SKIP_PREFIXES='arc/briefs- brief/ claude/ dependabot/ tmp-'`; `DIFF_RULE_PREFIXES='bot/'` (dependabot MOVES, it is not duplicated); three comment lines updated.
2. Four workflows (`perf-budget.yml`, `synthetic-ssr-monitor.yml`, `seo-check.yml`, `og-image-check.yml`): every preview job's `if:` gains `!startsWith(github.head_ref, 'brief/')` and `!startsWith(github.head_ref, 'tmp-')`; every `no-preview-reason` job's `if:` gains `startsWith(...'brief/')` and `startsWith(...'tmp-')`; the one-line step-summary message is reworded. The union in the workflows is now bot/ dependabot/ arc/briefs- brief/ claude/ tmp-, equal to the script's two lists together.
3. `tests/vercelDeploymentEnabled.test.ts`: `dependabot/...` now `false`; `brief/...` and `tmp-...` rows added.
4. `tests/vercelIgnoreBuild.test.ts`: three rows (a src change on `brief/x`, `tmp-merge-probe-1`, `dependabot/npm_and_yarn/x` all SKIP, even with a build path changed).
5. `docs/pr-batching-policy.md`: the prefix sentences match.

## Required status vs Vercel: none depends on a deployment (read 2026-11-04)

Ruleset "main checks" (id 24574372, include `~DEFAULT_BRANCH`) has 4 rules: deletion, non_fast_forward, and required_status_checks = `integrity`, `bundle-budget`, `e2e-smoke`, `wallclock-brand`, `masking-check`, `bom-check`, `unit (Europe/London, full)`, all with integration_id 15368 (GitHub Actions). No Vercel check is required, and the classic branch protection API answers 404 (not protected). A branch with deployments off posts no Vercel status, which therefore blocks nothing.
Two side effects, both harmless: (a) `dependabot/*` PRs lose their Vercel preview (their preview jobs were already excluded, and `phone-qa` / `bundle-budget` do not use a preview); (b) a `brief/*` or `tmp-*` PR (none exist today: land-brief pushes branches only) would show the five preview jobs as skipped with the reason job.

## Exactly which lines the owner must allow (workflow files; the guard-protected edits)

13 lines in 4 files, all on origin/main 2b8831448 (line numbers are of that commit; `if:` lines are the guard-required ones, the `msg=` lines are wording only and may be left out):

| File | `no-preview-reason` if: | `msg=` wording | preview job `if:` |
|---|---|---|---|
| `.github/workflows/perf-budget.yml` | 52 | 61 | 169 (lighthouse), 203 (doc-weight) |
| `.github/workflows/synthetic-ssr-monitor.yml` | 49 | 58 | 204 |
| `.github/workflows/seo-check.yml` | 38 | 47 | 163 |
| `.github/workflows/og-image-check.yml` | 84 | 93 | 246 |

Minimum for a green guard = the 9 `if:` lines (4 reason jobs + 5 preview jobs) plus the script and `vercel.json`. Nothing else in any workflow changes.

## How to check it (before pushing)

`node scripts/check-no-preview-prefixes.mjs` (exit 0), `node scripts/check-no-preview-prefixes.mjs --self-test`, `npx vitest run tests/vercelDeploymentEnabled.test.ts tests/vercelIgnoreBuild.test.ts tests/previewProbe.test.ts tests/buildRule.test.ts`. I did NOT run them (the patch was staged and diffed only). Not verified: that `tests/vercelIgnoreBuild.test.ts` rows 'docs-only on dependabot/* branch' (still SKIP) and any `dependabot` row elsewhere stay green after the move.

## The patch (from the repo root: `git apply --ignore-whitespace <file>`; the repo files are CRLF and this patch is LF, so the flag is required. Checked: `git apply --check --ignore-whitespace` against copies of the 8 origin/main files: OK. The tests were NOT run)

```diff
--- a/.github/workflows/perf-budget.yml
+++ b/.github/workflows/perf-budget.yml
@@ -49,7 +49,7 @@
   # an explicit reason instead of a bare "skipped". check-no-preview-prefixes.mjs
   # keeps its prefix list equal to the preview jobs' exclusions.
   no-preview-reason:
-    if: github.event_name == 'pull_request' && (startsWith(github.head_ref, 'bot/') || startsWith(github.head_ref, 'dependabot/') || startsWith(github.head_ref, 'arc/briefs-') || startsWith(github.head_ref, 'claude/'))
+    if: github.event_name == 'pull_request' && (startsWith(github.head_ref, 'bot/') || startsWith(github.head_ref, 'dependabot/') || startsWith(github.head_ref, 'arc/briefs-') || startsWith(github.head_ref, 'brief/') || startsWith(github.head_ref, 'claude/') || startsWith(github.head_ref, 'tmp-'))
     runs-on: ubuntu-latest
     timeout-minutes: 2
     permissions: {}
@@ -58,7 +58,7 @@
         env:
           HEAD_REF: ${{ github.head_ref }}
         run: |
-          msg="Preview checks in this workflow are SKIPPED by design for branch '$HEAD_REF': claude/* and arc/briefs-* get no Vercel deployment, bot/* and dependabot/* skip preview checks (docs/pr-batching-policy.md, Vercel build budget). A slice PR's evidence is the worker's sandbox table; preview checks run on PRs from feat/* and other branches."
+          msg="Preview checks in this workflow are SKIPPED by design for branch '$HEAD_REF': claude/*, arc/briefs-*, brief/*, tmp-* and dependabot/* get no Vercel deployment, bot/* skips preview checks (docs/pr-batching-policy.md, Vercel build budget). A slice PR's evidence is the worker's sandbox table; preview checks run on PRs from feat/* and other branches."
           echo "::notice title=No preview by design::$msg"
           echo "$msg" >> "$GITHUB_STEP_SUMMARY"
 
@@ -166,7 +166,7 @@
     # preview for its no-preview prefixes, so previewProbe would poll 600s then
     # THROW. Keep this list in sync with DIFF_RULE_PREFIXES +
     # ALWAYS_SKIP_PREFIXES there: npm run check:no-preview-prefixes fails on drift.
-    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'claude/')
+    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'brief/') && !startsWith(github.head_ref, 'claude/') && !startsWith(github.head_ref, 'tmp-')
     runs-on: ubuntu-latest
     timeout-minutes: 30
     # NOT continue-on-error: an infra failure here must be a loud red. Budget
@@ -200,7 +200,7 @@
     # preview for its no-preview prefixes, so previewProbe would poll 600s then
     # THROW. Keep this list in sync with DIFF_RULE_PREFIXES +
     # ALWAYS_SKIP_PREFIXES there: npm run check:no-preview-prefixes fails on drift.
-    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'claude/')
+    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'brief/') && !startsWith(github.head_ref, 'claude/') && !startsWith(github.head_ref, 'tmp-')
     runs-on: ubuntu-latest
     timeout-minutes: 15
     # NOT continue-on-error: same anti-masking rule as lighthouse.
--- a/.github/workflows/synthetic-ssr-monitor.yml
+++ b/.github/workflows/synthetic-ssr-monitor.yml
@@ -46,7 +46,7 @@
   # an explicit reason instead of a bare "skipped". check-no-preview-prefixes.mjs
   # keeps its prefix list equal to the preview jobs' exclusions.
   no-preview-reason:
-    if: github.event_name == 'pull_request' && (startsWith(github.head_ref, 'bot/') || startsWith(github.head_ref, 'dependabot/') || startsWith(github.head_ref, 'arc/briefs-') || startsWith(github.head_ref, 'claude/'))
+    if: github.event_name == 'pull_request' && (startsWith(github.head_ref, 'bot/') || startsWith(github.head_ref, 'dependabot/') || startsWith(github.head_ref, 'arc/briefs-') || startsWith(github.head_ref, 'brief/') || startsWith(github.head_ref, 'claude/') || startsWith(github.head_ref, 'tmp-'))
     runs-on: ubuntu-latest
     timeout-minutes: 2
     permissions: {}
@@ -55,7 +55,7 @@
         env:
           HEAD_REF: ${{ github.head_ref }}
         run: |
-          msg="Preview checks in this workflow are SKIPPED by design for branch '$HEAD_REF': claude/* and arc/briefs-* get no Vercel deployment, bot/* and dependabot/* skip preview checks (docs/pr-batching-policy.md, Vercel build budget). A slice PR's evidence is the worker's sandbox table; preview checks run on PRs from feat/* and other branches."
+          msg="Preview checks in this workflow are SKIPPED by design for branch '$HEAD_REF': claude/*, arc/briefs-*, brief/*, tmp-* and dependabot/* get no Vercel deployment, bot/* skips preview checks (docs/pr-batching-policy.md, Vercel build budget). A slice PR's evidence is the worker's sandbox table; preview checks run on PRs from feat/* and other branches."
           echo "::notice title=No preview by design::$msg"
           echo "$msg" >> "$GITHUB_STEP_SUMMARY"
 
@@ -201,7 +201,7 @@
     # preview for its no-preview prefixes, so previewProbe would poll 600s then
     # THROW. Keep this list in sync with DIFF_RULE_PREFIXES +
     # ALWAYS_SKIP_PREFIXES there: npm run check:no-preview-prefixes fails on drift.
-    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'claude/')
+    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'brief/') && !startsWith(github.head_ref, 'claude/') && !startsWith(github.head_ref, 'tmp-')
     runs-on: ubuntu-latest
     timeout-minutes: 15
     permissions:
--- a/.github/workflows/seo-check.yml
+++ b/.github/workflows/seo-check.yml
@@ -35,7 +35,7 @@
   # an explicit reason instead of a bare "skipped". check-no-preview-prefixes.mjs
   # keeps its prefix list equal to the preview jobs' exclusions.
   no-preview-reason:
-    if: github.event_name == 'pull_request' && (startsWith(github.head_ref, 'bot/') || startsWith(github.head_ref, 'dependabot/') || startsWith(github.head_ref, 'arc/briefs-') || startsWith(github.head_ref, 'claude/'))
+    if: github.event_name == 'pull_request' && (startsWith(github.head_ref, 'bot/') || startsWith(github.head_ref, 'dependabot/') || startsWith(github.head_ref, 'arc/briefs-') || startsWith(github.head_ref, 'brief/') || startsWith(github.head_ref, 'claude/') || startsWith(github.head_ref, 'tmp-'))
     runs-on: ubuntu-latest
     timeout-minutes: 2
     permissions: {}
@@ -44,7 +44,7 @@
         env:
           HEAD_REF: ${{ github.head_ref }}
         run: |
-          msg="Preview checks in this workflow are SKIPPED by design for branch '$HEAD_REF': claude/* and arc/briefs-* get no Vercel deployment, bot/* and dependabot/* skip preview checks (docs/pr-batching-policy.md, Vercel build budget). A slice PR's evidence is the worker's sandbox table; preview checks run on PRs from feat/* and other branches."
+          msg="Preview checks in this workflow are SKIPPED by design for branch '$HEAD_REF': claude/*, arc/briefs-*, brief/*, tmp-* and dependabot/* get no Vercel deployment, bot/* skips preview checks (docs/pr-batching-policy.md, Vercel build budget). A slice PR's evidence is the worker's sandbox table; preview checks run on PRs from feat/* and other branches."
           echo "::notice title=No preview by design::$msg"
           echo "$msg" >> "$GITHUB_STEP_SUMMARY"
 
@@ -160,7 +160,7 @@
     # preview for its no-preview prefixes, so previewProbe would poll 600s then
     # THROW. Keep this list in sync with DIFF_RULE_PREFIXES +
     # ALWAYS_SKIP_PREFIXES there: npm run check:no-preview-prefixes fails on drift.
-    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'claude/')
+    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'brief/') && !startsWith(github.head_ref, 'claude/') && !startsWith(github.head_ref, 'tmp-')
     runs-on: ubuntu-latest
     timeout-minutes: 10
     permissions:
--- a/.github/workflows/og-image-check.yml
+++ b/.github/workflows/og-image-check.yml
@@ -81,7 +81,7 @@
   # an explicit reason instead of a bare "skipped". check-no-preview-prefixes.mjs
   # keeps its prefix list equal to the preview jobs' exclusions.
   no-preview-reason:
-    if: github.event_name == 'pull_request' && (startsWith(github.head_ref, 'bot/') || startsWith(github.head_ref, 'dependabot/') || startsWith(github.head_ref, 'arc/briefs-') || startsWith(github.head_ref, 'claude/'))
+    if: github.event_name == 'pull_request' && (startsWith(github.head_ref, 'bot/') || startsWith(github.head_ref, 'dependabot/') || startsWith(github.head_ref, 'arc/briefs-') || startsWith(github.head_ref, 'brief/') || startsWith(github.head_ref, 'claude/') || startsWith(github.head_ref, 'tmp-'))
     runs-on: ubuntu-latest
     timeout-minutes: 2
     permissions: {}
@@ -90,7 +90,7 @@
         env:
           HEAD_REF: ${{ github.head_ref }}
         run: |
-          msg="Preview checks in this workflow are SKIPPED by design for branch '$HEAD_REF': claude/* and arc/briefs-* get no Vercel deployment, bot/* and dependabot/* skip preview checks (docs/pr-batching-policy.md, Vercel build budget). A slice PR's evidence is the worker's sandbox table; preview checks run on PRs from feat/* and other branches."
+          msg="Preview checks in this workflow are SKIPPED by design for branch '$HEAD_REF': claude/*, arc/briefs-*, brief/*, tmp-* and dependabot/* get no Vercel deployment, bot/* skips preview checks (docs/pr-batching-policy.md, Vercel build budget). A slice PR's evidence is the worker's sandbox table; preview checks run on PRs from feat/* and other branches."
           echo "::notice title=No preview by design::$msg"
           echo "$msg" >> "$GITHUB_STEP_SUMMARY"
 
@@ -243,7 +243,7 @@
     # preview for its no-preview prefixes, so previewProbe would poll 600s then
     # THROW. Keep this list in sync with DIFF_RULE_PREFIXES +
     # ALWAYS_SKIP_PREFIXES there: npm run check:no-preview-prefixes fails on drift.
-    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'claude/')
+    if: github.event_name == 'pull_request' && !startsWith(github.head_ref, 'bot/') && !startsWith(github.head_ref, 'dependabot/') && !startsWith(github.head_ref, 'arc/briefs-') && !startsWith(github.head_ref, 'brief/') && !startsWith(github.head_ref, 'claude/') && !startsWith(github.head_ref, 'tmp-')
     runs-on: ubuntu-latest
     timeout-minutes: 10
     permissions:
--- a/scripts/vercel-ignore-build.sh
+++ b/scripts/vercel-ignore-build.sh
@@ -16,7 +16,7 @@
 # push to a PR branch makes no new preview. No branch-name list decides it.
 #
 # BUILD BUDGET (non-production only, decided BEFORE the diff rule): a branch
-# under ALWAYS_SKIP_PREFIXES (arc/briefs-*, and every claude/* worker branch:
+# under ALWAYS_SKIP_PREFIXES (arc/briefs-*, brief/*, tmp-*, dependabot/*, and every claude/* worker branch:
 # slices, review and done-signal branches) and a commit whose SUBJECT ENDS with
 # `[skip preview]` (a worker checkpoint) always SKIP. vercel.json
 # git.deploymentEnabled also turns those prefixes off before any deployment exists (an ignored build still counts
@@ -94,16 +94,17 @@
 # synthetic-ssr-monitor.yml, seo-check.yml and og-image-check.yml exclude
 # exactly this union in their `if:`. scripts/check-no-preview-prefixes.mjs
 # fails CI when any workflow's list differs from these two lines together.
-#   DIFF_RULE_PREFIXES    bot PRs: the diff rule (as on every branch); their
+#   DIFF_RULE_PREFIXES    bot/ PRs: the diff rule (as on every branch); their
 #                         preview jobs stay excluded
-#   ALWAYS_SKIP_PREFIXES  never build a preview at all: brief/doc branches
+#   ALWAYS_SKIP_PREFIXES  never build a preview at all: brief/doc branches, tmp-* probes,
+#                         dependabot/* (its preview jobs are excluded anyway)
 #                         and every claude/* worker branch (slices, review,
 #                         done-signal). Workers test in their own sandbox; a
 #                         preview exists only for main and feat/* (vercel.json
 #                         KEEP_ON). Vercel Hobby: ~100 deploys / rolling 24 h;
 #                         on 2026-10-16 these were ~85% of 117 deploys.
-DIFF_RULE_PREFIXES='bot/ dependabot/'
-ALWAYS_SKIP_PREFIXES='arc/briefs- claude/'
+DIFF_RULE_PREFIXES='bot/'
+ALWAYS_SKIP_PREFIXES='arc/briefs- brief/ claude/ dependabot/ tmp-'
 
 # SKIP_PREVIEW_TAG: a worker CHECKPOINT commit ends its subject with this (the
 # SUBJECT is matched, never the body; check-no-preview-prefixes.mjs pins this
--- a/tests/vercelDeploymentEnabled.test.ts
+++ b/tests/vercelDeploymentEnabled.test.ts
@@ -28,7 +28,9 @@
     ['main', true],
     ['feat/organiser-rebuild', true],
     ['feat/account', true],
-    ['dependabot/npm_and_yarn/vite-6.4.1', true],
+    ['dependabot/npm_and_yarn/vite-6.4.1', false],
+    ['brief/my-ticket-order-qr-db', false],
+    ['tmp-merge-probe-1', false],
     ['bot/types-refresh', true],
     ['arc/organiser-r1', true],
     ['claude/vercel-slice-budget', false],
--- a/tests/vercelIgnoreBuild.test.ts
+++ b/tests/vercelIgnoreBuild.test.ts
@@ -405,6 +405,33 @@
     want: 'SKIP',
   },
   {
+    name: 'budget: src change on brief/*, tmp-* and dependabot/* branches skips (no deployment by policy)',
+    setup: () => {
+      const { cwd, base } = seedRepo();
+      commit(cwd, ['src/main.tsx']);
+      return { cwd, previousSha: base, ref: 'brief/x' };
+    },
+    want: 'SKIP',
+  },
+  {
+    name: 'budget: src change on a tmp-* branch skips',
+    setup: () => {
+      const { cwd, base } = seedRepo();
+      commit(cwd, ['src/main.tsx']);
+      return { cwd, previousSha: base, ref: 'tmp-merge-probe-1' };
+    },
+    want: 'SKIP',
+  },
+  {
+    name: 'budget: src change on a dependabot/* branch skips',
+    setup: () => {
+      const { cwd, base } = seedRepo();
+      commit(cwd, ['src/main.tsx']);
+      return { cwd, previousSha: base, ref: 'dependabot/npm_and_yarn/x' };
+    },
+    want: 'SKIP',
+  },
+  {
     name: 'budget: claude/review-* branch skips',
     setup: () => {
       const { cwd, base } = seedRepo();
--- a/docs/pr-batching-policy.md
+++ b/docs/pr-batching-policy.md
@@ -45,7 +45,7 @@
 for NON-production builds only:
 
 - **No preview for these branch prefixes:** `arc/briefs-` and `claude/`
-  always skip; `bot/` and `dependabot/` skip when no build path
+  always skip; `bot/` skips when no build path
   changed (as before). That list lives ONLY in the script
   (`ALWAYS_SKIP_PREFIXES` + `DIFF_RULE_PREFIXES`); the preview jobs' `if:` in
   `perf-budget.yml`, `synthetic-ssr-monitor.yml`, `seo-check.yml` and
@@ -70,7 +70,7 @@
   `"main": true`, `"feat/*": true`. Vercel deploys a branch when ANY matching key
   is `true` (a `true` always wins; unmatched branches deploy), so the guard
   allows no other `true` key: a stray glob such as `*-dev` would re-enable
-  slices. `bot/*` and `dependabot/*` are unmatched and keep deploying (their
+  slices. `bot/*` is unmatched and keeps deploying (its
   preview jobs are skipped anyway; the diff rule still skips docs-only bot
   builds). Why: 117 deploys in 24 h on 2026-10-16, ~55 of them `claude/*` slice
   previews nobody opened.
```
