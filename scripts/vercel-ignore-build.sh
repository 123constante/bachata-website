#!/bin/sh
# scripts/vercel-ignore-build.sh -- Vercel "Ignored Build Step" (vercel.json
# ignoreCommand). Decides whether a pushed commit needs a Vercel build at all.
#
#   exit 0  -> SKIP the build (Vercel marks the deployment CANCELED)
#   exit 1  -> BUILD
#
# Vercel's convention is the inverse of the usual "0 = success". Any other exit
# code (a crash, `sh: not found`, a missing file) also BUILDS, so every failure
# mode of this script is a wasted build, never a skipped one.
#
# RULE: skip only when the diff between the LAST SUCCESSFUL DEPLOYMENT of this
# branch and HEAD touches none of BUILD_PATHS below, on the branches where a
# skip is safe: production (main), bot/* and dependabot/*. A docs/ci/test-only
# merge to main no longer makes a new production deployment (production keeps
# serving the identical previous build).
#
# BUILD BUDGET (non-production only, decided BEFORE the diff rule): a branch
# under ALWAYS_SKIP_PREFIXES (arc/briefs-*, claude/done-*, claude/review-*)
# and a commit whose message carries `[skip preview]` (a worker checkpoint)
# always SKIP. Vercel Hobby allows ~100 deployments per rolling 24 h and we hit
# the limit on 2026-10-16 (see docs/pr-batching-policy.md, "Vercel build budget").
#
# Every OTHER branch always builds, because its PR's preview jobs need a
# preview for the exact head sha: perf-budget.yml (lighthouse, doc-weight),
# synthetic-ssr-monitor.yml, seo-check.yml and og-image-check.yml poll
# scripts/lib/previewProbe.mjs, which THROWS after 600s when no ready
# deployment exists for that sha. Those jobs exclude exactly the no-preview
# prefixes below; scripts/check-no-preview-prefixes.mjs keeps them in sync. A
# `[skip preview]` head is NOT excluded: previewProbe fails it FAST and RED (a
# head that was never previewed must not look verified).
#
# WHY THE BASE IS VERCEL_GIT_PREVIOUS_SHA, NOT HEAD~1: Vercel builds only the
# tip of a push. `HEAD~1` sees only the tip commit, so a push of [src change,
# docs change] would skip the build the src change needed. VERCEL_GIT_PREVIOUS_SHA
# is "the git SHA of the last successful deployment for the project and branch"
# (Vercel system env docs; only exposed when an Ignored Build Step is set), and a
# skipped build is CANCELED, not successful, so the base stays pinned to the last
# build that actually shipped until something build-relevant lands.
#
# WHY COMMIT-TO-COMMIT (`git diff BASE HEAD`), NOT `git diff BASE`: the one-arg
# form diffs against the WORKING TREE, which on Vercel may be missing files
# .vercelignore strips (package-lock.json, src/**/*.md). The old command used the
# one-arg form, and docs-only commits were observed building every time.
#
# FAIL-SAFE: every "don't know" BUILDS -- no git checkout, no base (first deploy
# of a branch), base not in Vercel's shallow (depth 10) clone, base == HEAD (a
# dashboard Redeploy, e.g. after an env var change: env is not in git), or git
# erroring. Each decision prints one line, visible in the Vercel build log.

# BUILD_PATHS: everything `npm install` + `react-router build` (+ Vercel's own
# api/ function build) reads, from the repo root. Derived from evidence, see the
# PR that introduced this file; when adding a build input, add it HERE or its
# changes will not deploy. Over-including only costs a build; under-including
# ships stale code, so when in doubt, add it.
#   app src                      route modules + the app (appDirectory: "app", "@/" -> src)
#   api                          Vercel functions dir (api/embed)
#   components pages             tailwind.config.ts `content` globs (CSS output)
#   public                       copied into build/client by Vite
#   index.html                   Vite HTML entry (SPA mode); cheap to include
#   middleware.ts                Vercel Edge middleware (imports app/*)
#   package*.json .npmrc         dependencies, the build script, postinstall
#   .nvmrc .node-version         Node version pins (none today)
#   bin/install-hooks.cjs        run by `postinstall` during npm install
#   vite.config.* vite.chunks.ts vite config + its manualChunks import
#   react-router.config.*        prerender list, vercelPreset
#   tsconfig*.json               parsed via tsconfck by the react-router config load
#   postcss.config.* tailwind.config.*   CSS pipeline
#   .env*                        Vite loadEnv reads .env, .env.production, ...
#   vercel.json .vercelignore    redirects/headers/images; what gets uploaded
#   .gitattributes               eol=crlf rewrites checked-out file bytes
#   scripts/vercel-ignore-build.sh   this rule itself: a rule change deploys once
BUILD_PATHS='app src api components pages public index.html middleware.ts
package.json package-lock.json .npmrc .nvmrc .node-version bin/install-hooks.cjs
vite.config.* vite.chunks.ts react-router.config.* tsconfig*.json
postcss.config.* tailwind.config.* .env* vercel.json .vercelignore
.gitattributes scripts/vercel-ignore-build.sh'

build() { echo "vercel-ignore-build: BUILD -- $1"; exit 1; }
skip() { echo "vercel-ignore-build: SKIP -- $1"; exit 0; }

# NO-PREVIEW BRANCH PREFIXES -- the ONE list. A branch starting with any of
# these never gets a PR preview, so the preview jobs in perf-budget.yml,
# synthetic-ssr-monitor.yml, seo-check.yml and og-image-check.yml exclude
# exactly this union in their `if:`. scripts/check-no-preview-prefixes.mjs
# fails CI when any workflow's list differs from these two lines together.
#   DIFF_RULE_PREFIXES    skip only when no build path changed (bot PRs)
#   ALWAYS_SKIP_PREFIXES  never build a preview at all: brief/doc branches,
#                         review branches, worker done-signal branches
#                         (Vercel Hobby: ~100 deploys / rolling 24 h; on
#                         2026-10-16 these were 36% of all builds)
DIFF_RULE_PREFIXES='bot/ dependabot/'
ALWAYS_SKIP_PREFIXES='arc/briefs- claude/done- claude/review-'

# SKIP_PREVIEW_TAG: a worker CHECKPOINT commit ends its subject with this (the
# SUBJECT is matched, never the body; check-no-preview-prefixes.mjs pins this
# literal equal to previewProbe.mjs's). Known cost: a dashboard Redeploy of a
# skipped head is skipped again; push a commit without the tag instead. The
# skipped build is CANCELED, so VERCEL_GIT_PREVIOUS_SHA stays on the last real
# deployment and the final untagged push builds normally. previewProbe.mjs
# fails such a head fast (red, never green): it was never previewed.
SKIP_PREVIEW_TAG='[skip preview]'

ref=${VERCEL_GIT_COMMIT_REF:-}
if [ "${VERCEL_ENV:-}" != production ]; then
  # Vercel sets VERCEL_GIT_COMMIT_REF to the bare branch name ("main", not
  # "refs/heads/main" -- the old command's spelling never matched).
  for p in $ALWAYS_SKIP_PREFIXES; do
    case $ref in "$p"*) skip "branch '${ref}' matches no-preview prefix '${p}'" ;; esac
  done
  # SUBJECT line only: a squash of checkpoints, a revert, or a body that merely
  # mentions the tag must not lose its preview.
  nl='
'
  msg=${VERCEL_GIT_COMMIT_MESSAGE:-}
  case ${msg%%"$nl"*} in
    *"$SKIP_PREVIEW_TAG"*) skip "commit subject carries '${SKIP_PREVIEW_TAG}' (worker checkpoint)" ;;
  esac
  # SKIP_ELIGIBLE for the diff rule: main plus DIFF_RULE_PREFIXES.
  eligible=
  [ "$ref" = main ] && eligible=1
  for p in $DIFF_RULE_PREFIXES; do
    case $ref in "$p"*) eligible=1 ;; esac
  done
  [ -n "$eligible" ] \
    || build "branch '${ref}' is not skip-eligible (its PR preview jobs need a preview)"
fi

git rev-parse --git-dir >/dev/null 2>&1 || build "no git checkout here"
head=$(git rev-parse --verify --quiet 'HEAD^{commit}') || build "cannot resolve HEAD"

base=${VERCEL_GIT_PREVIOUS_SHA:-}
[ -n "$base" ] || build "VERCEL_GIT_PREVIOUS_SHA empty (first deployment of this branch?)"
base=$(git rev-parse --verify --quiet "$base^{commit}") \
  || build "previous deployment ${VERCEL_GIT_PREVIOUS_SHA} not in this clone (shallow or unknown)"
[ "$base" != "$head" ] || build "HEAD is the previous deployment's commit (redeploy)"

# set -f: BUILD_PATHS is split on whitespace but its globs must reach git as
# pathspecs, not be expanded by the shell against the checkout.
set -f
# shellcheck disable=SC2086
git diff --quiet --no-renames --no-ext-diff "$base" "$head" -- $BUILD_PATHS
rc=$?
set +f
case $rc in
  0) skip "no build path changed in ${base} .. ${head}" ;;
  1) build "a build path changed in ${base} .. ${head}" ;;
  *) build "git diff failed (exit ${rc})" ;;
esac
