# Brief: og-tall-card-test (Website, normal lane, Opus)

Branch: `claude/og-tall-card-test`. Owner words 2026-11-10: "I just want a simple image of the flyer"; "very tall or very wide is okay, we can allow this"; "I like B more but the tall/wide flyer should not be cut. We need to see the entire card"; chose option E (a taller card shaped like the flyer). Inventory: `docs/design/whatsapp-event-preview.INVENTORY.md` (copy it from branch claude/welcome-contract if absent; if it is not on main, read `app/lib/ogCardRender.ts` directly).

## Goal
Find out whether WhatsApp shows a TALLER link card when `og:image` is not 1200x630. Build the taller layout so it can be tested on a real WhatsApp chat, WITHOUT changing what any normal event link shows.

## Who / what / how we know
- For: organisers pasting an event link into community WhatsApp groups.
- Afterwards: a portrait flyer shows large and whole on the card, never cropped.
- Worked when: the owner pastes `https://www.bachatacalendar.co.uk/event/<id>?ogtest=tall` into a real chat on iPhone and Android and the card is taller and complete. Not part of this PR: deciding to make it the default.

## Build (small, test-only switch)
1. `app/lib/ogCardRender.ts`: add a layout "tall". Card shape from the flyer ratio r = width/height: r >= 1.3 keeps the normal 1200x630 card; otherwise card ratio = max(r, 0.8) (so 4:5 at most; square flyers give 1:1). The whole flyer is drawn `fit:inside`, centred, on a backdrop that is the same flyer scaled to cover, blurred (about 22 px) and darkened (about 0.6). No text, no logo, no crop of the flyer. Tall canvases are 960 px wide (e.g. 960x1200). The JPEG must be <= 300 KB: step quality down (82, 74, 66) until it fits; never WebP.
2. `app/routes/api.og.card.tsx`: accept `layout=tall` (ignored otherwise); the ETag/cache key includes it. Never bake it (`decideBakePersist` unchanged).
3. `app/routes/event.tsx` loader/meta: if the request URL has `ogtest=tall` use the live `/api/og/card?...&layout=tall` as og:image with matching `og:image:width` and `og:image:height`. Without the param, output is byte-identical to today (add a test that asserts it for a baked and a live case). `ogtest` must not change canonical or og:url (canonical stays the plain event URL).
4. No-flyer events and failing flyers: unchanged (static or text fallback card).
5. Do not touch `OG_BRANDED_CARD_ENABLED` behaviour.

## Tests (table-driven, red first)
Shapes: portrait 4:5, tall 9:16, square, landscape 16:9, wide 3:1, tiny, WebP source, no flyer, unfetchable. For each: card size, JPEG <= 300 KB, flyer fully inside (no crop) by pixel check on the edges of the contain box, fallback marker unchanged. Event route: with and without `ogtest`.
Run every CI job step that applies; per-job table in the PR body; `check:og` is deploy-only (say so). Walk: the card URLs for the nine shapes opened and described; attach images to the PR.

## Limits
Event pages only. No migration, no DB writes, no new env var. 3 to 5 files plus tests. If more is needed, stop and report.

## Not verified in this PR (state in the body)
Real WhatsApp behaviour on iPhone and Android: owner/orchestrator test after merge.
