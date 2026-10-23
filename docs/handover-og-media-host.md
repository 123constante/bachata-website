# Handover: og-media-host

Brief: `briefs/og-media-host.md` on branch `brief/og-media-host`. Branch `claude/og-media-host`.

## Done
- `app/sameHostImage.ts`: one dependency-free leaf (Edge-safe, like `app/truncate.ts`) holding
  `sameHostImage()`. It moves an image URL onto the request host only when its hostname is the
  request host, `bachatacalendar.co.uk` or `www.bachatacalendar.co.uk`. Every other host, including
  `media.bachatacalendar.co.uk` (the R2 custom domain), is returned unchanged.
- `app/detailLoader.ts` and `middleware.ts` import it; both hand-copies are deleted.
- `app/ogImageHost.test.ts`: `resolveOgCardImage` with a stubbed `get_og_image_v1`, `normalizeOgImage`,
  and a table for `sameHostImage`. Red on main (4 failures: the media baked card comes back as
  `www.../events/og/...`), green after.
- Host-check sweep: listed in the PR body.
- Shape survey (read-only): `og_render` has 372 `ready` rows, all on `media.bachatacalendar.co.uk/events/og/`,
  and 23 `error` rows with no image URL.

## Left
- **PR not opened.** `gh pr create` was refused (HTTP 403: GraphQL is not available from Claude Code
  sessions), and the brief forbids `gh api` and the MCP create tool. Open it from
  `claude/og-media-host` with the title and body below.
- After merge + deploy: `curl -A "WhatsApp/2.23" https://www.bachatacalendar.co.uk/event/el-grande`
  should show og:image on `https://media.bachatacalendar.co.uk/events/og/...`, and that URL should return 200.
  The sandbox could not reach prod (proxy 403), so this was not run.
- Optional: re-scrape a few shared links in the Facebook Sharing Debugger so cached previews refresh.

## Next
- `scripts/check-origin-consumers.mjs` `isFirstPartyUrl` still counts any `*.bachatacalendar.co.uk` as
  first-party. That is only a classification in an inventory guard (no SQL posts to the media host
  today), so it was left as is. If a DB function ever calls the media host, narrow it there.

## PR to open
Title: `fix(og): keep share images on the media host so link previews show a picture`

Body:

````markdown
## Summary
**The failure (prod, since 2026-10-21 12:05Z).** Event links shared on WhatsApp/Facebook show no picture. Admin migration 20261129670000 (#904) moved every stored media URL from `pub-07f6...r2.dev` to `media.bachatacalendar.co.uk`, including `og_render.image_url` (the baked 1200x630 share cards). `sameHostImage()` in `app/detailLoader.ts` and its copy in `middleware.ts` moved ANY `*.bachatacalendar.co.uk` image onto the request host. So `https://media.bachatacalendar.co.uk/events/og/event/<id>.jpg` became `https://www.bachatacalendar.co.uk/events/og/event/<id>.jpg`, which is a 404. The orchestrator measured this on prod with `curl -A "WhatsApp/2.23" .../event/el-grande`.

**Before:** any `*.bachatacalendar.co.uk` image, including `media.`, was moved onto the host the crawler fetched.
**After:** an image is moved onto the request host only when its hostname is the request host itself, `bachatacalendar.co.uk` or `www.bachatacalendar.co.uk`. Every other host (`media.`, r2.dev, third parties, look-alikes) is returned unchanged. The baked card goes out on `media.bachatacalendar.co.uk`, which serves it with a 200.

**Implementation.** The function is now ONE shared, dependency-free module, `app/sameHostImage.ts` (Edge-safe, the same pattern as `app/truncate.ts` and `app/edgeCacheControl.ts`). `middleware.ts` and `app/detailLoader.ts` both import it, and both hand-copies are deleted, so they cannot disagree again. The existing comment's reason is kept (crawlers need the host they fetched for SITE pages; the apex->www 308; relative URLs), plus one line on why the media host is excluded.

## Red first
New `app/ogImageHost.test.ts` covers `resolveOgCardImage` with a stubbed `get_og_image_v1`, `normalizeOgImage`, and a table of 11 `sameHostImage` cases. It was run against **unchanged main** `detailLoader.ts`, with the old regex extracted verbatim:
```
 × resolveOgCardImage ... > leaves a media.bachatacalendar.co.uk baked card unchanged
- https://media.bachatacalendar.co.uk/events/og/event/01173937-0000-4000-8000-46b1f42d630c.jpg
+ https://www.bachatacalendar.co.uk/events/og/event/01173937-0000-4000-8000-46b1f42d630c.jpg
 × sameHostImage > media host unchanged
 × sameHostImage > media host unchanged on an apex fetch
 × sameHostImage > unknown subdomain unchanged
      Tests  4 failed | 11 passed (15)
```
After the fix: `Tests 15 passed (15)`. Apex and www are still moved to the request host in both directions, and http is still upgraded.

## Host-check sweep (`*.bachatacalendar.co.uk` treated as "our site")
| Place | Verdict |
|---|---|
| `app/detailLoader.ts` `sameHostImage` | **fixed** (shared helper) |
| `middleware.ts` `sameHostImage` | **fixed** (shared helper) |
| `app/csp.ts` img-src/media-src | fine: lists `media.bachatacalendar.co.uk` explicitly |
| `vercel.json` `images.remotePatterns` (`/_vercel/image`) | fine: lists `media.bachatacalendar.co.uk` explicitly |
| `src/lib/imageCdn.ts` `OPTIMIZABLE_HOSTS` | fine: exact host set that includes `media.` |
| `app/routes/api.og.card.tsx` / `api.og.bake.tsx` (`fetchImageBytes`) | fine: no host allow-list or SSRF guard on the fetch; it fetches the src as given, so `media.` URLs work |
| `scripts/check-og-images.mjs` `isOnBakeHost` | fine: exact `media.` match, with a look-alike canary |
| `scripts/check-origin-consumers.mjs` `isFirstPartyUrl` | fine for now: inventory classification only, and no SQL posts to the media host. Noted in the handover |
| `scripts/lint-workflow-notification.mjs` `PROD_HOST` | fine: matches workflow BASE_URL text, not image hosts |
| `app/cloudflarePurge.ts` `CF_SITE_HOST` | fine: exact `www.` |

An independent reviewer swept app/, src/, api/, middleware.ts and vercel.json again and found no other suffix-style site check.

## Effect on requests reaching Vercel
This changes which host crawlers fetch share images from. A baked card (all 372 `ready` rows) is now fetched straight from **R2 via `media.bachatacalendar.co.uk`**, not through Vercel. Before #904 the same requests also went to R2 (r2.dev). Between 12:05Z and this fix they went to Vercel and got a 404. So this removes those 404 requests from Vercel and adds no new Vercel traffic. The live `/api/og/card` fallback (no baked row) is unchanged and still served by Vercel on the request host.

## CI (every PR job step, run locally on this branch)
| Command | Exit |
|---|---|
| bin/check-integrity.sh | 0 |
| check:legacy-tables / check:legacy-program-rpcs / lint:architecture | 0 / 0 / 0 |
| AUDIT_STRICT=1 check:images / check:image-widths (+self-test) | 0 / 0 |
| check:plan-hygiene:self-test / check:workflow-artifact-policy (+self-test) | 0 / 0 |
| check:mojibake (+self-test) / prove:entry-point (+self-test) | 0 / 0 |
| check:rpc-typing / check:wallclock-brand | 0 / 0 |
| test:unit:offline | **1**: 5 tests in `tests/integrityCouldNotRun.test.ts`; **identical 5 failures on unmodified main** in this sandbox (environmental); 10547 others pass |
| test:unit:timing / check:dancer-area-isolation | 0 / 0 |
| lint-workflow-masking / lint-workflow-notification / check-no-preview-prefixes | 0 / 0 / 0 |
| check:seo:self-test / check:og:self-test | 0 / 0 |
| check:doc-weight | **1**: cannot run locally (`GITHUB_REPOSITORY is not set`; probes the preview) |
| check:bundle-budget / first-load-requests / chunk-cycles (+self-tests) | 0 |
| npm run build | 0 |
| npm run lint | 0 |
| test:e2e | **1**: 3 of 161 failed in the full run. `organiser-home.spec:55` **also fails on unmodified main**. `dancer-app/home-nights.spec:75` and `organiser-layout.spec:171` pass when re-run alone. All three are organiser/dancer UI this PR does not touch |
| check:og / check:seo / live-db contract checks | need a deploy or secrets; left to GitHub Actions |

## Verified on real data (required)
- Shapes surveyed (read-only, counts): `og_render` has 372 `ready` rows, **all** on host `media.bachatacalendar.co.uk` under path `/events/og/`, and 23 `error` rows with a null image_url (these fall to the live card, which is a site URL and still moved). The test uses that exact shape.
- Checks run: red-first unit test, the CI table above, independent review (no blocking findings).
- NOT verified: the live prod or preview og:image after deploy. The sandbox proxy blocks prod (403), so `curl -A "WhatsApp/2.23" <preview>/event/el-grande` still needs running on the Vercel preview. Also not verified: a real WhatsApp/Facebook re-scrape.

## Phone QA
N/A: no UI change (server-side og:image meta only).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01NEJcMmaBir5QucJaSXpS5Z
````
