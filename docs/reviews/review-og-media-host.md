# Review: PR #921 `fix(og): keep share images on the media host so link previews show a picture`

Reviewer brief: `briefs/og-media-host-review.md` (brief/og-media-host, blob c7218490). PR head reviewed: `cbd17478`.
Independent reviewer, not the author. Nothing on `claude/og-media-host` was changed.

## Verdict: **SHIP**

No blocking or should-fix findings. The fix is minimal and correct, the Edge bundle is clean, the test is
red on main and green on the head, and every PR CI job on the head is green.

## 1. Host set: is any legitimate SITE URL now left un-rewritten?

New rule (`app/sameHostImage.ts`): rewrite when `img.hostname === request hostname` OR hostname is
`bachatacalendar.co.uk` / `www.bachatacalendar.co.uk`. Old rule: request hostname OR `*.bachatacalendar.co.uk`.
The only hosts that changed behaviour are subdomains other than apex/www. A repo-wide grep
(`app src middleware.ts vercel.json scripts api`) finds only two `*.bachatacalendar.co.uk` names:
`www.` (52 hits) and `media.` (11 hits). No other subdomain serves the site, so nothing legitimate lost its rewrite.

Every caller walked:

| Caller | URL it passes | Result on head |
|---|---|---|
| `app/detailLoader.ts:337` `resolveOgCardImage` (event, festival), baked | `og_render.image_url` on `media.` | unchanged, so `media.` 200 (**the fix**) |
| same, live fallback | `${SITE_ORIGIN}/api/og/card?...` (www) | moved onto the request host, as before |
| same, no cover | `fallbackImage` returned early, never through `sameHostImage` | unchanged from main (pre-existing) |
| `app/detailLoader.ts:366` `normalizeOgImage`: venue-entity, djs, organiser, people, dancers, teachers | `${SITE_ORIGIN}/api/og/card?kind=image&src=<cover>` | wrapper is www, so it is moved; the `src` param (media cover) is untouched. Test pins this |
| `middleware.ts:413` `meta.image = sameHostImage(meta.image, url.origin)` | `ogNormalizedImage()` uses `${SITE_URL}/api/og/card...` or `FALLBACK_OG_IMAGE` (www) | moved, as before |
| relative URL (`SITE_URL` empty) | `/api/og/card?...` | resolved against the request origin, so it matches the request hostname and is moved (test case) |
| Vercel preview request host | www URL on an `*.vercel.app` request | moved onto the preview host (test case); a preview-host URL is kept |

Note: `SITE_URL` in middleware is `process.env.SITE_URL`. If it were ever set to a non-apex/www host other than
the request host, it would no longer be rewritten. The same was true on main for any non-bachatacalendar host,
so this is not a regression.

## 2. Edge middleware bundle

- `app/sameHostImage.ts` has **zero imports** (same leaf pattern as `app/truncate.ts` / `app/edgeCacheControl.ts`, #272).
- `npx esbuild middleware.ts --bundle --format=esm --platform=browser --conditions=edge-light,worker,browser`
  gives exit **0**. The output has **0** `node:`/`fs`/`path`/`crypto` imports, and `SITE_HOSTS` + the new check are inlined.
- `npm run build` gives exit **0** (the React Router build does not emit the Vercel middleware bundle, so the esbuild
  pass above is the Edge evidence. The authoritative proof is the Vercel preview build, which I could not read: see Not verified).

## 3. Test, both ways

- Head: `npx vitest run app/ogImageHost.test.ts` gives **15 passed (15)**, exit 0.
- Main (`origin/main` worktree, test copied in, `app/sameHostImage.ts` = main's middleware function verbatim, exported;
  `resolveOgCardImage` exercised through main's own `detailLoader.ts` copy) gives **4 failed | 11 passed**:
  `leaves a media.bachatacalendar.co.uk baked card unchanged`, `media host unchanged`,
  `media host unchanged on an apex fetch`, `unknown subdomain unchanged`. That is exactly the bug.

## 4. Sweep spot-checks (two author "fine" verdicts)

- `app/csp.ts` **confirmed fine**: img-src and media-src list `https://media.bachatacalendar.co.uk` explicitly (lines 27-28).
  og:image is fetched by crawlers, not the page, so CSP is not on this path anyway.
- `api.og.card` / `api.og.bake` via `fetchImageBytes` (`app/lib/ogCardRender.ts:583`) **confirmed fine** for `media.`:
  a plain `fetch(url)` with a 5s timeout and a 12 MB cap, with no host allow-list, so media covers fetch.
  (Also checked: `src/lib/imageCdn.ts:28` lists `media.` exactly. `scripts/check-origin-consumers.mjs:185` `isFirstPartyUrl`
  is suffix-based, as the author notes; it is inventory-only. Agree it is fine for now.)

## 5. Build and unit job (run locally on head `cbd17478`)

| Command | Exit |
|---|---|
| `npm run build` | 0 |
| `npx vitest run app/ogImageHost.test.ts` | 0 (15/15) |
| `npm run test:unit:offline` (unit-tests.yml PR path) | 1: 6 failed / 10556 passed. 5 in `tests/integrityCouldNotRun.test.ts`, **identical 5 fail on unmodified main** here (sandbox: linked worktree + symlinked node_modules). 1 in `tests/client/festivalClientState.test.tsx`: **passes 8/8 re-run alone** (load from the concurrent build); the file is untouched by the PR |
| esbuild Edge bundle of `middleware.ts` | 0, no Node-only imports |

GitHub Actions on head `cbd17478` (PR #921): all completed jobs **success**: unit (London full, Sydney, New_York),
e2e-smoke, integrity, bundle-budget, contract-check, live-db-gate, wallclock-brand, dancer-area-isolation,
bom/masking/notification-check, phone-qa-section, decide. `real-data-verified` failed at 14:16Z and **passed** on the
14:37Z re-run (after the PR body edit). Skipped (by design, preview-gated): og-preview, og-check, seo-preview,
seo-check, synthetic(-preview), lighthouse, doc-weight. No commit statuses (Vercel) were visible via the API.

## Findings

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | nit | `img.hostname.toLowerCase()`: WHATWG `URL` already lowercases hostnames, so this is redundant | optional; harmless to keep |
| 2 | nit (pre-existing, out of scope) | `/api/og/card?kind=image&src=` fetches ANY URL server-side (no host allow-list): an open fetch proxy / SSRF surface. Not introduced or worsened by this PR | separate follow-up: allow-list `src` hosts to the media hosts (`media.`, the two r2.dev buckets, `*.supabase.co`) |
| 3 | nit | Crawlers (WhatsApp/Facebook) cache the 404 og:image per URL; links shared 12:05Z to deploy may keep showing no picture until re-scraped | post-deploy: Facebook Sharing Debugger re-scrape for key events (already in the author's handover) |

## Verified / Not verified

- **Verified:** host-set reasoning over every caller; Edge leaf has zero imports and bundles with no Node-only import;
  `npm run build` 0; red on main (4 failed) and green on head (15/15); unit job local (only environmental/flaky
  failures, shown on main / on re-run); PR CI green on head; two sweep verdicts spot-checked.
- **Not verified:** the Vercel preview build and `curl -A "WhatsApp/2.23" <preview>/event/el-grande`. The sandbox
  proxy refuses `api.vercel.com` (CONNECT 403) even though VERCEL_TOKEN is set, so there is no preview URL. **Needs owner:
  Vercel access from the sandbox, or run the curl on the preview by hand.** Also not verified: prod after deploy and a real
  WhatsApp/Facebook re-scrape. I did no fresh Supabase shape survey; I relied on the author's (372 `ready` rows, all on `media.`).
