# CI bypass header (`X-CI-Bypass`)

Cloudflare's WAF challenges ("Just a moment", HTTP 403) the production probes
that run from GitHub Actions: Sitemap Submit, Prod Smoke (`/_vercel/image`
loads), SEO Guard and OG Image Guard. A Cloudflare custom rule skips the
challenge for requests carrying a shared secret in `X-CI-Bypass`.

The og-render health check is NOT covered: its 403 comes from the database
(pg_net) and is a separate admin item.

## How the code behaves

- `scripts/lib/ciBypassHeader.mjs` &mdash; `ciBypassHeaders(env)` returns
  `{ 'x-ci-bypass': <value> }` when `CI_BYPASS_HEADER` is non-blank (trimmed),
  else `{}`. A value with CR/LF or non-printable-ASCII throws; the message never
  contains the value.
- Sent to `https://www.bachatacalendar.co.uk` ONLY (`ciBypassHeadersFor(url)` /
  `isProductionUrl`). Never to a Vercel preview, Supabase, Google, R2/media or
  any other host.
- Env var absent &rarr; requests are byte-identical to before.
- Wired into: `check-sitemap-fetchable.mjs`, `check-seo.mjs`,
  `check-og-images.mjs`, `launch-critical-smoke.mjs` (Playwright `context.route`,
  registered only when the secret exists).
- Tests: `tests/scripts/ciBypassHeader.test.ts`.

## Cloudflare rule

Security &rarr; WAF &rarr; Custom rules. Expression:

```
(http.request.headers["x-ci-bypass"][0] eq "<secret>")
```

Action: **Skip** &mdash; all remaining custom rules, managed rules, Bot Fight
Mode, and rate limiting. Place it first in the list.

## Rotate

1. Generate a new value (`openssl rand -hex 32`; printable ASCII only).
2. Add it to the Cloudflare rule alongside the old one
   (`... or ... eq "<new>"`), then update the GitHub secret
   `CI_BYPASS_HEADER` (`gh secret set CI_BYPASS_HEADER`).
3. Re-run a probe, then remove the old value from the rule.

## Workflow `env:` lines still needed

Workflow files are edited separately. Add this line to the `env:` of each step:

```yaml
CI_BYPASS_HEADER: ${{ secrets.CI_BYPASS_HEADER }}
```

| Workflow | Step (runs) |
|---|---|
| `sitemap-submit.yml` | the step running `node scripts/check-sitemap-fetchable.mjs` (not `--self-test`) |
| `prod-smoke.yml` | the step running `node scripts/launch-critical-smoke.mjs` (already has `SMOKE_BASE_URL`) |
| `seo-check.yml` | the production step running `npm run check:seo` (~line 92); NOT the preview job |
| `og-image-check.yml` | the production step running `npm run check:og` (~line 152); NOT the preview job |

The preview jobs do not need it: the helper would send nothing to a
`*.vercel.app` host anyway.
