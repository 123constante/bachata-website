# Handover: /api/og/card image source allow-list (SSRF hardening)

Brief: `brief/og-card-src-allowlist:briefs/og-card-src-allowlist.md` (sha e734dd4). Branch `claude/og-card-src-allowlist`.

## Done
- `app/lib/ogImageSourceAllowlist.ts`: `isAllowedOgImageSource(url)` + `OG_IMAGE_SOURCE_HOSTS`. https only; no
  userinfo, no port, no IP literals; exact lower-cased host match (no suffix match); the Supabase host only under
  `/storage/v1/object/public/`. Hosts = `vercel.json` `images.remotePatterns` (3) + supabase, unsplash, www + apex site.
  `example.com` is not allowed.
- `fetchImageBytes` (`app/lib/ogCardRender.ts`) refuses a disallowed URL BEFORE fetch and uses `redirect: "error"`.
  This covers `kind=image`, event/festival covers, and `/api/og/bake` (same function, no behaviour change there beyond that).
- `api.og.card.tsx`: `kind=image` with a refused `src` -> 302 to the static card, new reason `image-source-disallowed`.
  Event/festival covers on a refused host keep `cover-unfetchable`.
- Tests: `tests/ogImageSourceAllowlist.test.ts` (allowed -> fetch called with `redirect: "error"`; 21 refused shapes ->
  fetch never called; redirect -> null; allow-list == vercel.json remotePatterns + extras; real prod URLs).
  `tests/ogCardFallbackMarker.test.ts`: two `image-source-disallowed` route cases (metadata IP, non-listed host);
  the `image-source-unfetchable` and passthrough cases now use an allowed host.

## Red first (unfixed main)
- `ogImageSourceAllowlist.test.ts`: 28 failed / 3 passed with the module present but `fetchImageBytes` unfixed
  (every refused case reached fetch; allowed cases had no `redirect: "error"`).
- `ogCardFallbackMarker.test.ts`: both `image-source-disallowed` cases failed `expected 200 to be 302` (the metadata
  URL was fetched and served as a card).

## Real-data check (read-only SELECTs, URLs only, 2026-10-21)
| source | URL | verdict |
|---|---|---|
| event_series_p5.default_cover_image_url | https://media.bachatacalendar.co.uk/images/events/covers/2026/06/b14e8d19-....webp | allowed |
| event_series_p5.default_cover_image_url | https://media.bachatacalendar.co.uk/images/2026/05/1778167362413-z94h1zs1tim.webp | allowed |
| og_render.cover_source_url | https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/public/images/2026/04/1776677357217-2ac1j72kuwr.jpg | allowed |
| event_series_p5.default_cover_image_url | https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/public/organiser-flyers/... | allowed |
| event_series_p5.default_cover_image_url | https://images.unsplash.com/photo-1516450360452-9312f5e86fc7 | allowed |
| member_profiles.avatar_url | https://example.com/proof-avatar-1776689247243.jpg | refused (intended) |
These are pinned as a table in the test file.

## Gates run locally (exit codes)
| job / step | command | exit |
|---|---|---|
| architecture-guard | bin/check-integrity.sh | 0 |
| architecture-guard | check:legacy-tables, check:legacy-program-rpcs, lint:architecture | 0 |
| architecture-guard | AUDIT_STRICT=1 check:images, check:mojibake:self-test | 0 |
| typecheck | check:rpc-typing, check:wallclock-brand | 0 |
| typecheck | `npm run typecheck` | 2 on main AND branch, 99 errors both (pre-existing; none new) |
| unit-tests | `npm run test:unit` | 1: 15 failures, identical 15 on unmodified main (live-DB contract tests + integrityCouldNotRun, sandbox env) |
| unit-tests | check:dancer-area-isolation | 0 |
| workflow-lint | lint-workflow-notification, check-no-preview-prefixes | 0 |
| lint | `npm run lint` (with bin/*.sh chmod +x as CI does) | 0 |
| perf-budget | `npm run build` (production), check:bundle-budget, check:first-load-requests, check:chunk-cycles | 0 |

## Not verified
- No screen changes (server-side fetch policy only), so no browser walk.
- e2e-smoke (Playwright) not run in the sandbox; live `check:og` needs a deploy.
- Vercel preview not checked (no VERCEL_TOKEN check performed).

## Next steps
- Review + one fix pass. After merge, `npm run check:og` against prod: a cover on an unlisted host would now show as
  `cover-unfetchable` (survey says none exist outside example.com test rows).
