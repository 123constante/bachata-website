# Session handover: 2026-10-06, seo-preview noindex fix

Branch `claude/seo-preview-noindex-fix`, PR #590. Class: GUARD-CI.

## Done
- Root cause: `seo-preview` has been red on every non-skipped PR since ad69753
  (2026-09-12, pushed straight to main). That commit made an `X-Robots-Tag: noindex`
  header a hard failure in `checkPage` (`scripts/check-seo.mjs`). Vercel adds that header
  to every preview deployment. The app emits it only on >= 400 responses, and the strict
  production run stayed green.
- Fix (f8699ab):
  - `checkPage` takes `preview` (default `isPreviewHost(BASE)`). On `*.vercel.app` the
    header is a warn. Status 200, robots meta, canonical on www, title/description/h1,
    JSON-LD and the floors are all still asserted.
  - Production still fails on the header.
  - Canary goes from 66 to 73 cases. Seven mutants each turn it red.
- Live proof (run 37446893009): every preview page that answered 200 showed the new warn,
  and none failed on the header.
- 409bc7a merges main into the branch, so CI runs fresh after the outage.

## Incident seen this session (owner notified by push)
- About 09:56 to 10:30 UTC, the prod Supabase DB returned statement timeouts (Postgres
  `57014`).
- Effects:
  - www served HTTP 500 on `/` and the landing pages (SEO Guard run 37446412802).
  - Every preview served 500 too.
  - The live-DB contract tests failed.
- It was not a code regression: five prod deploys with the same dependencies passed
  between 09:07 and 09:49.
- At 10:59 the preview for 409bc7a still returned 500 on `/city/london-gb` (`lighthouse`
  job 112234666089). The backend may still be intermittent.

## Open
- The checks on #590 at 409bc7a are still running. `lighthouse` is red with a 500 on
  `/city/london-gb`. That is backend trouble: the diff touches only `check-seo.mjs` and
  workflow YAML.
- I can't re-run jobs from a cloud session: `rerun-failed-jobs` returns 403.
- Needs `/code-review low` before merge (guard logic).

## Next
1. Read the check runs on #590 at 409bc7a, starting with `seo-preview`. Expected: green, or
   red only on HTTP 500s / floors caused by the backend.
2. Once prod SSR is healthy, have the owner re-run the failed jobs on #590.
3. Investigate the Supabase statement timeouts (admin repo / Supabase dashboard).

## Local environment notes
- In the cloud container, push with `NODE_PATH=` cleared. A global NODE_PATH breaks
  `tests/integrityCouldNotRun.test.ts` (it also fails on pristine main).
- I set `core.fileMode false` locally, because of mode-only flips on `bin/*.sh` and
  `.githooks/*`.
