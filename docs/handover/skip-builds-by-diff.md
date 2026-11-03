# Handover: skip Vercel builds by diff (dispatch dt_467106cc2001)

Brief: `brief/skip-builds-by-diff:docs/briefs/skip-builds-by-diff.md`. Branch `claude/skip-builds-by-diff`.

## Done
- `scripts/vercel-ignore-build.sh` uses **build by diff on every branch**. There is no branch-name list for this rule now. A non-production push skips when `git diff VERCEL_GIT_PREVIOUS_SHA HEAD -- $BUILD_PATHS` is empty. These rules have not changed:
  - `claude/*` and `arc/briefs-*` always skip.
  - A subject ending `[skip preview]` skips.
  - Every doubt BUILDS: no previous sha (first push), a base missing from the clone, a redeploy (base == head), a git error, an empty `VERCEL_GIT_COMMIT_REF`.
  - Production behaves exactly as before.
- `scripts/lib/buildRule.mjs` is the only JS reader of the rule. It **parses** `BUILD_PATHS` from the shell script, so the list exists only once, and implements git's default pathspec matching. A test runs real `git diff` against the matcher. A second `BUILD_PATHS` assignment fails a test, and an unsupported bracket form throws, which callers treat as doubt.
- `scripts/lib/previewProbe.mjs` handles a head that has no preview with `findIdenticalPreview`:
  - It looks for the newest of up to 20 ancestors that has a READY preview.
  - It calls the GitHub compare API for `base...head`. The result must be `ahead`, have a file list, and have fewer than 300 files.
  - If no file (including `previous_filename`) is a build path, it returns **that ancestor's preview URL**. The app code is identical, so the job stays green AND still measures something real. It does not skip with nothing measured.
  - Any doubt means it keeps polling, and it fails red after 600 s as before.
  - `[skip preview]` heads still fail fast and red.
  - It needs no caller or workflow changes: lighthouse, doc-weight, synthetic-ssr, seo and og all take the URL.
- Preview jobs needing a head preview (all via `resolvePreviewUrl`):
  - perf-budget.yml: lighthouse (`check-lighthouse.mjs`) and doc-weight (`check-doc-weight.mjs`).
  - synthetic-ssr-monitor.yml PR job (`resolve-preview-url.mjs`).
  - seo-check.yml and og-image-check.yml.

## Counts (git history of main, first-parent squash commits, counts only)
- 681 PR merges. **235 touched no build path** (whole-PR diff), so every push of those PRs after the first would skip.
- Last 100 PRs: 69 touched no build path. (Many of those were `claude/*` branches that already skip.)

## Left / next steps (owner's call)
- **The first push of a new branch still builds**, because Vercel has no `VERCEL_GIT_PREVIOUS_SHA` for that branch yet, and the brief says doubt builds. A single-push docs PR therefore still costs one build. A possible follow-up: fall back to `git merge-base origin/main HEAD` when there is no previous sha. That needs `main` in Vercel's shallow clone, and that is not verified.
- I could not observe how Vercel reports an ignored build on GitHub (deployment status shape). So the probe does not depend on it: it decides from the rule plus an existing ancestor preview.
- `DIFF_RULE_PREFIXES` (bot/, dependabot/) stays, only so their preview jobs remain excluded. Those jobs could be re-enabled now; that is a separate PR with workflow edits.
- A Vercel env-var change is not in git. After one, a docs-only push serves the old build; use a dashboard Redeploy.
