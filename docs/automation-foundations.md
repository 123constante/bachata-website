# Automation foundations -- notes

## Deployment storage: brief/* branches made deployments nobody visits (2026-11-05)

`Deployment Storage Check` measured `508 retained x 13.97 MB = 7.10 GB of 10 GB`
(run 41990183260). The run goes red at the WARN tier, `deploymentStorage.warnGB`
5 GB, so the gap is 2.10 GB. At 13.97 MB a deployment, green needs 357 or fewer
retained deployments. At 508 retained, it needs 9.84 MB or less per deployment.

- **Bundle lever.** Measured by tracing `build/server/nodejs_*/index.js` with
  `@vercel/nft`, run once in a scratch dir and not added to the repo. The main
  function is 12.66 MB deflated (36.19 MB raw, 1797 files). Of that, 8.40 MB is
  `sharp` plus `@img/sharp-libvips-linux-x64`, which
  `app/lib/ogCardRender.ts` needs at runtime for `/api/og/card` and
  `/api/og/bake`. It is a live dependency, not build tooling. Nothing else
  over 0.5 MB deflated can be dropped without a code change, so this lever
  closes nothing on its own. Removing sharp would mean a different OG renderer,
  and the owner decides that.
- **Deploy-rate lever.** `brief/*` branches are full repo copies pushed by the
  orchestrator. They were in neither `ALWAYS_SKIP_PREFIXES` nor
  `git.deploymentEnabled`. Each push therefore created a Vercel deployment
  record: CANCELED when the subject ends `[skip preview]`, a full preview build
  when it does not. The guard counts every retained record. There were 363
  `brief/*` heads on origin; by tip date that was 13 to 49 a day from 2026-10-23
  to 2026-11-05. `main` saw 423 first-parent merges in the 30 days to
  2026-11-05, 278 of them touching a build path (about 9 production builds a
  day). The fix: `brief/` joins `ALWAYS_SKIP_PREFIXES`, `"brief/*": false` joins
  `vercel.json`, and the four preview workflows exclude it.
  `check-no-preview-prefixes.mjs` keeps those lists in sync. This tightens the
  rules; no ignore rule was loosened. Records that already exist only leave
  through retention, so the guard stays red until they age out.
