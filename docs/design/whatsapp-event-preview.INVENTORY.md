# INVENTORY: WhatsApp / link preview for an event link (2026-11-10, website-50)

Read-only sweep of Website main 893163504 (`C:/dev/wt-welcome`) and admin origin/main (local ref, not fetched). Env values on Vercel not visible.

## Today
- An event link preview is a generated 1200x630 JPEG that CONTAINS the flyer (not the flyer itself). Flag off (default in code, prod value NOT VERIFIED): the flyer is letterboxed (`fit:"inside"`, can upscale) on a dark #141519 canvas, no text, no logo, no blur, no crop (`app/lib/ogCardRender.ts:160-165`). Flag `OG_BRANDED_CARD_ENABLED` on (`ogCardRender.ts:192`, read at `:548-552`): flyer centre-cropped to a 630x630 square with dark pillars, scrim, category pill, title, "date . venue" (`:474-530`).
- No flyer: loader returns static `/og-image.jpg` (`app/detailLoader.ts` ~318-337). Flyer unfetchable: text-only fallback card with `X-OG-Fallback` marker (`ogCardRender.ts:131-158`, `app/routes/api.og.card.tsx:72-82`).
- Short links: NOT FOUND in the Website repo. Share URL shape `/event/<slug-or-uuid>[?occurrenceId=]` (`src/lib/seo/eventHref.ts:11-14`).

## Where the tags come from
| Item | file:line |
|---|---|
| Event route SSR loader + meta (all visitors incl. bots; middleware.ts does NOT handle /event) | `app/routes/event.tsx:172-267`, `middleware.ts:28-73` |
| Tags emitted: title, description (max 160), canonical, og:type website, og:title (bare name), og:description, og:url, og:image + width 1200 + height 630 + type image/jpeg, twitter:card summary_large_image + twitter:image | `event.tsx:236-267` |
| NOT emitted: og:site_name, og:image:alt, twitter:title/description | `event.tsx`, `root.tsx:40-58` |
| og:image choice: baked R2 URL from RPC `get_og_image_v1`, else live `/api/og/card?kind=event&id=..&v=<token>`, else static | `app/detailLoader.ts` 283-337, `app/sameHostImage.ts` |
| Flyer source: cover_image_url ?? hero_image_url, else first photo_urls, else venue image (card route only) | `src/lib/eventCoverImage.ts:18-29`, `useEventPageQuery.ts:181-191`, `ogCardRender.ts:735-739` |
| Output JPEG q82 mozjpeg, never WebP; 300KB limit enforced only by the guard, not at render | `ogCardRender.ts`, `scripts/check-og-images.mjs:57` |
| Bake to R2 and re-bake on cover change only (triggers on poster_url / cover_image_url / default cover); title/date/venue edits do NOT re-bake | `app/routes/api.og.bake.tsx`, `ogBakePolicy.ts:93-110`, admin baseline migration lines 3458-3520, 56072 |
| Cache: healthy `public, s-maxage=31536000`; degraded 300 s / 3600 s / no-store; no edge purge reaches cards | `api.og.card.tsx:104-142`, `vercel.json:146` |
| Guard: daily cron + PR + production deployments, WhatsApp UA, checks absolute https, dimensions, not WebP, <=300KB, no fallback marker | `scripts/check-og-images.mjs`, `.github/workflows/og-image-check.yml` |
| Tests: cache/marker spec (mocked renderer, no pixels), branded layout (real sharp render) | `app/routes/api.og.card.test.tsx`, `tests/ogBrandedCardLayout.test.ts` |

## Edge cases (behaviour today, flag off)
| Flyer | Result |
|---|---|
| 1080x1920 tall | scaled to about 354x630 centred, about 423 px dark bars each side (whole flyer, small) |
| very wide (4:1) | 1200 wide, dark bars above and below |
| small | upscaled (blurry) |
| WebP source | decoded and re-encoded as JPEG |
| no flyer | static /og-image.jpg |

## Gaps
- No test or guard checks how tall or wide flyers look. The guard measures bytes and type only.
- Whether the prod flag is on: NOT VERIFIED.
- City is not drawn on the card.

## Coverage
Files cited: 24. NOT FOUND: short links; spec doc for the intended design. NOT VERIFIED: prod flag value, `_og_scrape` Facebook trigger, share-link UX docs (`docs/design/p3-share-event-link*.md` not read).
