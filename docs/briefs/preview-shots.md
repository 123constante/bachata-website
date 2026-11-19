# Brief: preview-shots CI job (branch claude/preview-shots)

Owner picks (2026-11-19): advisory job, never a required check. CI-only PR, no flag, no .tsx/.css.

Build ONE new workflow `.github/workflows/preview-shots.yml` (+ script `scripts/preview-shots.mjs`, + a unit test for the route-list parser):
1. Trigger: pull_request (non-draft) on paths src/**, app/**, components/**, pages/**, public/**, index.html. Skip bot/* and dependabot/* like perf-budget.yml. Concurrency: cancel superseded runs per PR.
2. Resolve the PR preview first-party with `scripts/lib/previewProbe.mjs` (same as perf-budget.yml lighthouse job; same VERCEL_AUTOMATION_BYPASS_SECRET). Read perf-budget.yml and previewProbe.mjs first and copy their bypass handling. A proven protection wall or an ignored build = green skip with ::warning::; any other failure = job red but job is NOT a required check.
3. Playwright (reuse the repo's playwright dependency) at viewport 390x844, deviceScaleFactor 2, captures: `/` and the city page `/city/london-gb`; ONE real upcoming event page (read-only: fetch the first upcoming public event id with the anon key the site already uses, SELECT only); the menu sheet open (click `[data-testid="header-menu-button"]`, wait for role=dialog, capture); plus every route listed in the PR body under a line `Preview routes:` (comma or space separated, max 6, must start with `/`, reject anything with `//` or a scheme).
4. Upload PNGs as an artifact (retention 7 days) and post/update ONE PR comment (marker `<!-- preview-shots -->`) with the preview URL and the artifact link. Use `permissions: pull-requests: write, contents: read, actions: read`. No secrets in the comment.
5. Read-only against prod data. No writes, no sign-in, no localStorage seeding of tickets.

Do NOT touch phone-qa.yml, any required check name, triggers of other workflows, or runs-on of existing jobs. New workflow only. Check `scripts/check-script-conventions.mjs` six rules and the workflow allow-list guard before pushing (a new workflow may need an allow-list entry: read the guard and add it if required).

Push once coherent; this is a workflow PR so it builds no preview need (subject may use [skip preview] only if no UI path changed). PR body: Verified on real data block (shapes only), no Phone QA section (no UI path). Hard tier (workflow file): independent review required before merge.
