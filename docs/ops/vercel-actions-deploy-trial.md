# Vercel deploys from GitHub Actions &mdash; STEP 1 TRIAL (handover)

PR #1354. Ticket `dt_9529cca6a577`, branch `claude/vercel-actions-deploy-trial-1`,
brief `docs/briefs/vercel-actions-deploy-trial-1.md` on `brief/vercel-actions-deploy-trial-1`.

## What this adds (and what it does not)

- `.github/workflows/deploy-production-trial.yml` &mdash; on every push to `main`:
  - job `decide`: `node scripts/deploy-trial-decide.mjs` says deploy / skip from
    the ONE rule (`BUILD_PATHS` in `scripts/vercel-ignore-build.sh`, read by
    `scripts/lib/buildRule.mjs`; no second list).
  - job `deploy-preview` (only when a build path changed): `vercel pull
    --environment=production`, `vercel build`, `vercel deploy --prebuilt`
    &mdash; a **PREVIEW** deployment. No `--prod`, no alias, no
    `vercel promote`. The summary shows the preview URL, commit sha and build
    seconds.
- Production is **unchanged**: Vercel's own Git production build is still ON
  and still serves the site. `vercel.json`, Cloudflare and every Vercel setting
  are untouched.
- Until the three secrets below exist, `deploy-preview` prints a notice
  ("Deploy trial skipped: repo secret(s) not set") and stays **green**.

Real-data number (last 30 first-parent commits on `main` at `aa87484`,
`node scripts/deploy-trial-decide.mjs --survey 30`): **12 of 30 would skip**
(docs/ci/test/workflow only), 18 would deploy.

Known difference from Vercel's ignore step: Vercel diffs against the last
**successful** deployment (`VERCEL_GIT_PREVIOUS_SHA`); the trial diffs against
the push's `before` sha. They only disagree right after a failed main deploy.

## Owner steps: add the three repo secrets (about 10 minutes)

You need the Vercel dashboard and the GitHub repo settings, both in a browser.

1. **Make a token.** Vercel &rarr; click your avatar (top right) &rarr;
   **Account Settings** &rarr; **Tokens** &rarr; **Create Token**.
   Name: `github-actions-deploy-trial`. Scope: the team/account that owns the
   Bachata Calendar project. Expiration: 90 days is fine for a trial.
   Click **Create** and copy the token now (it is shown once).
2. **Find the project id and org id.** Vercel &rarr; open the Bachata Calendar
   project &rarr; **Settings** &rarr; **General**. Copy **Project ID**
   (starts `prj_`). Then for the org id: if the project is under your personal
   account, Account Settings &rarr; General &rarr; **Vercel ID** (starts
   `team_` or is your user id); if under a team, the team's Settings &rarr;
   General &rarr; **Team ID**.
3. **Add them to GitHub.** github.com/123constante/bachata-website &rarr;
   **Settings** &rarr; **Secrets and variables** &rarr; **Actions** &rarr;
   **New repository secret**, three times, names exactly:
   - `VERCEL_TOKEN` &mdash; the token from step 1
     (one may already exist for `deployment-storage-check.yml`; if it is a
     read-only token, replace it with the new full-access one or deploys fail)
   - `VERCEL_ORG_ID` &mdash; from step 2
   - `VERCEL_PROJECT_ID` &mdash; from step 2
4. **Prove it.** Actions tab &rarr; **Deploy Production Trial** runs on the next
   code merge to `main`. Open the run &rarr; the summary should show a
   `...vercel.app` preview URL.

## 5-merge comparison checklist

For the next 5 merges to `main`, fill one row each (Vercel dashboard
Deployments page for the Git build; the Actions run summary for the trial):

| # | main sha | docs-only? | Vercel Git prod build: built or CANCELED? | Trial: deployed or skipped? | Agree? | Git build time | Trial build time | Trial preview loads `/city/london-gb` at 390px? |
|---|----------|-----------|------|------|------|------|------|------|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |

Include at least one docs-only merge and at least one code merge. Every
"Agree?" must be YES before a Step 2 (switching production over) is planned.
If any row disagrees, note both decisions and the Vercel build log line
`vercel-ignore-build: ...` for that sha.

## Status at hand-off

- Done: helper + table tests, workflow, inventory row in
  `docs/ci-guard-notes.md`, `scripts/prove-entry-point-dispatch.mjs` TARGETS
  entry, this doc.
- NOT verified: the deploy job itself (needs the owner's secrets); whether
  `vercel build` with the production env copied to the preview env file behaves
  identically to the Git production build (that is what the checklist measures).
- Next: owner adds secrets &rarr; 5-merge checklist &rarr; Step 2 brief.
