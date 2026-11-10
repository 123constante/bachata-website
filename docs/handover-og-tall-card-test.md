# Handover: og-tall-card-test (test-only tall WhatsApp card)

Brief: `docs/briefs/og-tall-card-test.md` (copied from branch `brief/og-tall-card-test`).
Branch: `claude/og-tall-card-test`.

## What shipped
- `app/lib/ogCardRender.ts`: `tallCardSize`, `flyerDisplaySize`, `tallCardSizeFor`,
  `buildTallCard`. Flyer ratio r = w/h: r >= 1.3 -> normal `buildCoverCard`
  (1200x630, flag behaviour untouched); else 960 wide at ratio max(r, 0.8).
  Whole flyer `fit:inside`, centred, on the same flyer cover-scaled, blurred
  (sigma 22) and darkened (x0.6). JPEG q82 -> 74 -> 66 until <= 300 KB.
- `app/routes/api.og.card.tsx`: `layout=tall` honoured for `kind=event` only,
  folded into the ETag only when set (plain ETags byte-identical). Tall cards
  are cached `public, max-age=3600` with no Vercel CDN directive. Never baked.
- `app/lib/ogTallPreview.server.ts`: page-side URL + declared size, from the same
  flyer and the same sizing function as the renderer. Any failure -> null.
- `app/routes/event.tsx`: `?ogtest=tall` -> og:image/twitter:image = the tall
  URL, og:image:width/height = real size; 2.5 s budget. Without the param the
  loader data has no `ogTall` key and the head is unchanged. Canonical/og:url
  ignore the param.

## How to test on a phone
Paste `https://www.bachatacalendar.co.uk/event/<slug>?ogtest=tall` into a real
WhatsApp chat (iPhone and Android) and compare with the plain URL. WhatsApp
caches previews per URL; add e.g. `&x=2` for a fresh fetch.

## Known limits
- Page and card fetch the flyer separately; if the card's fetch fails it serves
  the normal 1200x630 fallback while the page declared the tall size.
- Removal: if WhatsApp does not draw a taller card, delete the four pieces above
  and the tests (`tests/ogTallCard.test.ts`, `tests/ogTallPreview.test.ts`,
  `app/routes/event.ogTall.test.ts`). Making it the default is a separate decision.

## Verification (worker run 2026-11-10)
- Shape survey (prod, read-only counts): 99 public series (live 75, ended 23,
  paused 1), every one has a cover; 95 WebP, 4 JPEG. Flyer pixel sizes are not
  stored, so the ratio mix is unknown from the DB.
- Real flyers NOT rendered: this worker's network policy refuses
  media.bachatacalendar.co.uk (CONNECT 403). The nine brief shapes were rendered
  with a synthetic framed flyer instead: 4:5, 9:16 and tiny -> 960x1200; square
  -> 960x960; 16:9 and 3:1 -> 1200x630; WebP -> 960x1200; all 24-49 KB; frame
  whole on every card. No-flyer / unfetchable -> unchanged fallback + marker.
- Red first: 19 of the new tests fail on main.

## Next steps
1. Owner/orchestrator: after merge, paste `/event/<slug>?ogtest=tall` for a
   portrait-flyer event into WhatsApp on iPhone and Android; compare with the
   plain link.
2. If the card is taller and whole: separate PR to decide on default + bake.
   If not: remove (see Known limits).
