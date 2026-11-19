# preview-shots handover

Done: `.github/workflows/preview-shots.yml`, `scripts/preview-shots.mjs`, `scripts/lib/previewShotsRoutes.mjs`, `tests/previewShotsRoutes.test.ts` (9 tests, pass; `--self-test` exits 0).
Checks run locally: check:no-preview-prefixes (0 drift), check-script-conventions, workflow artifact-policy / masking / notification / log-secrets, check:mojibake, new vitest file.

OWNER ACTION NEEDED: `scripts/data/automation-workflow-allowlist.json` must list `preview-shots.yml`. The guard (`check-automation-workflow-allowlist`) refuses a `claude/` PR that edits the list, and refuses an unlisted workflow, so this PR stays red on that guard until the owner lands the one-line list entry in a PR of their own.

Design notes: the job's `if:` excludes the full no-preview union (bot/, dependabot/, arc/briefs-, brief/, claude/, tmp-) because `check-no-preview-prefixes` requires it for any job that imports `resolvePreviewUrl`. So worker `claude/` PRs get no shots, by design of the repo.

Not verified: a live run on a real preview (needs the PR from a non-claude branch); the comment step; Playwright capture (chromium not exercised, capture is injected in the self-test).
