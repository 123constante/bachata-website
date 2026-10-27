# Brief: send a CI bypass header from the production probes (no-op until the secret exists)

Repo 123constante/bachata-website. Branch `claude/ci-bypass-header` from `main`. Lane: normal (no DB, no migration). Sonnet is enough; Opus if the Playwright part fights back.

## Why
The owner is adding a Cloudflare WAF custom rule that SKIPS the challenge when a request carries `X-CI-Bypass: <secret>` (GitHub Actions secret `CI_BYPASS_HEADER`). Today the production probes get Cloudflare's "Just a moment" 403 and email a failure on every merge: Sitemap Submit (`sitemap.xml` answered HTTP 403 to `BachataCalendar-SitemapGuard/1`), Prod Smoke (browser image loads of `/_vercel/image?...` answer 403), SEO Guard, OG Image Guard. Do NOT touch the og-render health check: that 403 comes from the database (pg_net), a separate admin item.

## Deliver (scripts + tests + docs; you cannot edit `.github/workflows/**`, so DO NOT try)
1. One shared helper `scripts/lib/ciBypassHeader.mjs`: `ciBypassHeaders(env = process.env)` returns `{ 'x-ci-bypass': <value> }` when `CI_BYPASS_HEADER` is set and non-empty after trim, else `{}`. It must refuse (throw) a value containing CR/LF or anything outside printable ASCII, and must never log the value.
2. Use it ONLY for requests whose target host is the production host (`www.bachatacalendar.co.uk` / the project's existing production-host constant; find it, do not hardcode a second copy). Never send it to a Vercel preview host, Supabase, Google or any third party (a header with a secret must not leave the zone). Add a test that a non-production URL gets no header.
3. Wire it into: the sitemap fetch check (find the script `sitemap-submit.yml` runs), the Prod Smoke runner (Playwright: `extraHTTPHeaders` on the context, production host only via a `page.route` or the context `baseURL` host check, read how `prod-smoke.yml` runs it), the SEO probe and the OG probe that hit production (`seo-check.yml`, `og-image-check.yml`: use `scripts/lib/previewProbe.mjs` conventions). Keep every existing behaviour when the env var is absent (byte-identical requests).
4. Tests (vitest, table-driven): set/unset/blank/CRLF value; production host vs preview vs third party; the helper's output never appears in a thrown error message. Run `check-script-conventions.mjs` rules and every CI step that applies (read `.github/workflows`).
5. `docs/ops/ci-bypass-header.md`: what it is, the exact Cloudflare rule expression `(http.request.headers["x-ci-bypass"][0] eq "<secret>")` with action Skip (all remaining custom rules, managed rules, bot fight, rate limiting), how to rotate, and the list of EXACT `env:` lines the workflows still need, one block per workflow and step (`CI_BYPASS_HEADER: ${{ secrets.CI_BYPASS_HEADER }}`), because workflow files are edited separately by the orchestrator. Put the same list at the top of the PR body.

## Done =
Push `claude/ci-bypass-header` once; final commit subject ends with the done marker from your prompt. Honest Verified / Not verified in the PR body: say that nothing was run against production and the bypass is unproven until the Cloudflare rule and secret exist.
