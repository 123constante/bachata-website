# ACCEPTANCE CONTRACT: whole-flyer link card for every event (DRAFT 1, 2026-11-10, website-50)

Status: DRAFT 1. Not reviewed. No build dispatched. Lane: careful (public route, prod default, bake pipeline) with independent review; the lead (website-8e) sees the reviewed contract before any build dispatch. Inventory: docs/design/whatsapp-event-preview.INVENTORY.md plus section 4 below. Run record: ~/.claude/plans/PLAN-og-whole-flyer-rollout-2026-11-10.md.

## 1. Owner decisions (binding; relayed by lead 2026-11-10)
- W1 Who for: people receiving shared links AND organisers sharing them, equally.
- W2 Card content: the flyer only. No text, no logo. A blurred, darkened backdrop of the same flyer for wide AND tall flyers. Nothing of the flyer is cut off.
- W3 Rollout: whole-flyer becomes the default for ALL events only after it is built and checked on real events (BOS Majorca and a few others). No instant switch-on at merge.
- W4 (earlier, owner phone check 2026-11-10) The test tall card (PR #1517, ?ogtest=tall) looked good in WhatsApp.

## 2. Design choices (lead-reversible, logged)
- D1 One renderer, one rule: the whole flyer is drawn fit:inside, centred, on a cover-scaled, blurred (sigma 22), darkened (x0.6) copy of itself (the #1517 treatment). Canvas size follows the flyer: width 960; height 960 / r with r clamped to [0.8, 1.91]; so tall flyers give 4:5 at most, squarish flyers give about 1:1 to 1.2:1, wide flyers give up to 1.91:1 (960x503). A flyer wider than 1.91 (2 of 33 sampled: 2.28, 3.14) gets blurred bars top and bottom; none of it is cropped. The old rule that flyers with r >= 1.3 keep the 1200x630 branded card is REMOVED for the new mode. Open point for review: whether wide cards should be 1200 wide instead of 960 (WhatsApp shows large previews at the declared ratio; 960 keeps the size under 300 KB).
- D2 Declared sizes: og:image:width and og:image:height are the REAL pixel size of the card, computed by the same function the renderer uses (as #1517 does), never a constant.
- D3 Mode switch, one env var OG_WHOLE_FLYER_MODE with four values: off (today, default), test (only ?ogtest=whole-flyer, like #1517), allowlist (named events: OG_WHOLE_FLYER_EVENT_IDS), on (every event). Read once at module load like OG_BRANDED_CARD_ENABLED; a Vercel env change plus redeploy is the switch AND the rollback. In every mode other than off for a given event, the old branded card is NOT used for that event.
- D4 Versioned identity: the whole-flyer card changes the etag, the baked R2 object key and the og_render cover_hash/URL by a renderer-version segment (for example wf1), so an old baked object is never confused with a new one, and a later tweak is a new version, not a purge. Old objects stay in R2 untouched until the cleanup decision (rollback needs them).
- D5 Cache: until mode is on for everyone, the whole-flyer card is cached at most 1 hour at the edge (r2 of #1517 observed 4 h on prod although the PR said 1 h: A1 must find out why and make the header match the intent). After the all-events flip and one week without a defect, the long cache returns.
- D6 Size ceiling 300 KB enforced AT RENDER with the q82, q74, q66 ladder (as #1517), JPEG only, never WebP. If the last rung is still over 300 KB the card is not served: fall back to the existing card for that event and emit the X-OG-Fallback marker so the guard sees it.
- D7 Backfill: the already-baked rows (event 392 ready, festival 9 ready, event 23 error) are re-baked by the existing scripts/backfill-og-images.mjs pattern, in small batches, only in mode allowlist or on, one batch of at most 25 per run, each batch followed by a read-only count of ready/error rows. Error rows are retried once and then left for review. No DB migration is expected: the write is the same og_render upsert the bake route already does; A1 must prove it by reading the bake route and the upsert.
- D8 Title, date and venue are no longer on the card, so the known gap "an edit does not re-bake" (inventory) disappears for whole-flyer cards. A cover or poster change still re-bakes (existing triggers).
- D9 Guard: scripts/check-og-images.mjs (daily cron, PR, production deploys, WhatsApp UA) must accept the new sizes (declared size equals actual size, ratio within [0.8, 1.91], <= 300 KB, JPEG, no fallback marker) and must still fail on the old failure modes. It is changed in the same slice as the renderer, with a mutation check that the new rule rejects a 3:1 card and a WebP card.
- D10 No new public route, no new table, no new SQL. If A1 finds it needs one, it stops and returns to the lead.

## 3. Person types
P1 someone who receives the link in WhatsApp (iPhone or Android). P2 someone who receives it in another app (iMessage, Facebook, Telegram, X, Slack). P3 the organiser who shares their own event. P4 the operator (this team): runs the backfill, flips the mode, rolls back. P5 a crawler or the daily guard (WhatsApp user agent, no cookies). P6 a person who only opens the event page (never sees the card; included to prove the page is unchanged: R8).

## 4. Data shapes (flyer) with PROD counts (read-only, project stsdtacfauprzrdebmzg, 2026-11-10)
og_render rows: event ready 392 (392 with an image), event error 23 (no image, last updated 2026-10-21), festival ready 9. Live series: 55 recurring or course, 20 one-off or festival live (see pause-series survey); many occurrences of one series share one cover, so distinct covers are far fewer than rows.
Sample: 90 baked rows chosen by md5 order gave 34 distinct cover URLs; 33 measured (1 fetch error). Ratio w/h of the 33: under 0.6 very tall 4; 0.6 to 0.8 tall 5; 0.8 to 1.0 portrait or square-ish 6; 1.0 to 1.3 square or landscape 10; 1.3 and over wide 8 (1.59, 1.6, 1.78, 1.78, 1.82, 1.82, 2.28, 3.14). Range 0.56 to 3.14. Pixels: short side 373 to long side 1920. Largest source file 318 KB. All sampled sources are WebP or JPEG.

| Shape | Description | Evidence | Today (flag ON, branded) | New card |
|---|---|---|---|---|
| F1 | very tall, ratio under 0.6 | 4 of 33 | cropped to a centre square | 960x1200 (4:5), flyer shrunk to fit |
| F2 | tall, 0.6 to 0.8 | 5 of 33 | cropped | 960x1200 |
| F3 | portrait, 0.8 to 1.0 | 6 of 33 | cropped | 960 by 960/r |
| F4 | square or landscape, 1.0 to 1.3 | 10 of 33 | cropped | 960 by 960/r |
| F5 | wide, 1.3 to 1.91 | 6 of 33 | cropped to a square, title overlaid | 960 by 960/r, whole flyer |
| F6 | ultra wide, over 1.91 | 2 of 33 | cropped | 960x503, blurred bars above and below |
| F7 | tiny flyer (short side under 400 px) | min 373 px seen; none under 300 | upscaled | upscaled by fit:inside; must stay readable (fixture) |
| F8 | huge flyer (long side over 4000 px) or very large file | max 1920 px seen on prod | n/a | must not time out the render (fixture); R2 and 2.5 s page budget |
| F9 | no flyer | event with no cover | static /og-image.jpg | unchanged (R5 for the new card) |
| F10 | flyer cannot be fetched or is corrupt | 23 error rows (no image) | text fallback card with X-OG-Fallback | unchanged fallback; the guard must flag it |
| F11 | festival | 9 ready rows | branded card | same whole-flyer rule (kind=festival) |
| F12 | already baked (R2 object exists) | 392 events + 9 festivals | old baked card served by get_og_image_v1 | re-baked in D7 batches; until then the old one stays |
| F13 | kind=image card (dancer, venue, other entities) | route supports kind=image | unchanged | OUT OF SCOPE, unchanged (R5) |
| F14 | occurrence-specific card (the occ parameter of one night of a series) | route supports occ | branded card of that night | same whole-flyer rule; occ stays in the etag |
Honest limit: link previews are cached by the receiving app (WhatsApp, Facebook) per URL for days; a link already shared keeps its old picture until the app refreshes it. We cannot purge WhatsApp. Journey K13 asserts only that the old link still shows A card (not broken), and new shares show the new one.

## 5. Journeys
K1 share an event link in WhatsApp (iPhone and Android). K2 share the link in another app (iMessage, Facebook, Telegram, X, Slack). K3 organiser publishes an event with a flyer and shares it at once. K4 organiser replaces the flyer: card refreshes. K5 event with no flyer. K6 flyer cannot be fetched or is corrupt. K7 title, date or venue edited after the card was made. K8 allowlist stage: card is whole-flyer only for named events. K9 flip the default to whole-flyer for every event. K10 rollback to the current cards. K11 backfill re-bakes the already-baked events. K12 the daily OG guard runs against the new cards. K13 a link already shared before the change.

## 6. Slices (sequenced)
- B0 docs: this contract, inventory, review.
- B1 renderer and guard (careful, Website only, after the contract is accepted): whole-flyer card for the wide range in app/lib/ogCardRender.ts (extend the #1517 builder, do not fork it), D3 mode env, D4 versioning in etag and R2 key, D5 header fix, D6 ceiling, D9 guard change with mutation test. Tests: table-driven over the F1 to F8 fixtures with a REAL sharp render (not mocked), asserting dimensions equal the declared ones, <= 300 KB, JPEG, whole flyer present (a pixel check that the flyer edges are on the canvas), no text. Mode off must be byte-identical to today (golden test).
- B2 staged check (no code): lead or owner sets OG_WHOLE_FLYER_MODE=allowlist with BOS Majorca and 4 more real events (one of each: very tall, tall, square, wide, ultra wide); read-only walk of each card, then owner WhatsApp check on iPhone and Android.
- B3 backfill batches (D7) in allowlist or on mode, with the read-only count after each batch.
- B4 flip to on (the owner decision W3 happens here: "default for all events only after checked"), then one week watch, then long cache.
- Rollback at every step: set mode back to off and redeploy; the old baked objects are untouched (D4).

## 7. Not verified
Prod value of OG_BRANDED_CARD_ENABLED is ON (seen on prod: BOS Majorca card is the cropped branded card) but the Vercel setting itself is not visible to us. The sample is 33 covers, not all ~400. What WhatsApp, iMessage, Facebook, Telegram, X and Slack each do with a card that is not 1.91:1 (WhatsApp tall card checked by the owner on one phone; Android and the other apps not). Why the tall card header showed max-age=14400. Whether the daily guard needs the WhatsApp UA change. Real-phone check of every shape.

## 8. Coverage matrix (generated and tallied by script; every cell carries a code)
Reason codes: R5 not applicable: no flyer, a kind not in scope, or a path that is not this card; R6 only walkable on a fixture or preview, never on prod data; R7 only applies once the shape has a baked object (backfill); R8 not this person's journey.

### 8a. Person x journey
| Journey | P1 | P2 | P3 | P4 | P5 | P6 |
|---|---|---|---|---|---|---|
| K1 share an event link in WhatsApp (iPhone and Android) | yes | R8 | yes | R8 | R8 | R8 |
| K2 share the link in another app (iMessage, Facebook, Telegram, X, Slack) | R8 | yes | yes | R8 | R8 | R8 |
| K3 organiser publishes an event with a flyer and shares it at once | yes | yes | yes | R8 | R8 | R8 |
| K4 organiser replaces the flyer: card refreshes | yes | yes | yes | yes | R8 | R8 |
| K5 event with no flyer | yes | yes | yes | R8 | yes | R8 |
| K6 flyer cannot be fetched or is corrupt | yes | yes | yes | yes | yes | R8 |
| K7 title, date or venue edited after the card was made | yes | yes | yes | R8 | R8 | R8 |
| K8 allowlist stage: card is whole-flyer only for named events | yes | yes | yes | yes | yes | R8 |
| K9 flip the default to whole-flyer for every event | yes | yes | yes | yes | yes | R8 |
| K10 rollback to the current cards | yes | yes | yes | yes | yes | R8 |
| K11 backfill re-bakes the already-baked events | R8 | R8 | R8 | yes | R8 | R8 |
| K12 the daily OG guard runs against the new cards | R8 | R8 | R8 | yes | yes | R8 |
| K13 a link already shared before the change | yes | yes | yes | R8 | R8 | R8 |

6 persons x 13 journeys = 78 cells: yes 44, coded 34, GAP 0.

### 8b. Journey x flyer shape
| Journey | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 | F9 | F10 | F11 | F12 | F13 | F14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K1 share an event link in WhatsApp (iPhone and Android) | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes |
| K2 share the link in another app (iMessage, Facebook, Telegram, X, Slack) | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes |
| K3 organiser publishes an event with a flyer and shares it at once | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | R5 | R5 | yes |
| K4 organiser replaces the flyer: card refreshes | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes |
| K5 event with no flyer | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 | yes | R5 | R5 | R5 | R5 | R5 |
| K6 flyer cannot be fetched or is corrupt | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 | yes (R6 fixture) | R5 | R5 | yes | R5 |
| K7 title, date or venue edited after the card was made | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes |
| K8 allowlist stage: card is whole-flyer only for named events | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | yes | yes (R6 fixture) | yes | yes | R5 | yes |
| K9 flip the default to whole-flyer for every event | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | yes | yes (R6 fixture) | yes | yes | R5 | yes |
| K10 rollback to the current cards | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | yes | yes (R6 fixture) | yes | yes | R5 | yes |
| K11 backfill re-bakes the already-baked events | R7 | R7 | R7 | R7 | R7 | R7 | R7 | R7 | R5 | R5 | yes | yes | yes | R7 |
| K12 the daily OG guard runs against the new cards | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | yes | yes (R6 fixture) | yes | yes | R5 | yes |
| K13 a link already shared before the change | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes |

13 journeys x 14 shapes = 182 cells: yes 123, coded 59, GAP 0.

## 9. GRANT list
None. No SQL, no new table, no new route (D10). If review or A1 finds a new grant, the contract is wrong and goes back to the lead.

## 10. Owner decisions still open
None that block the contract. For the lead at B2/B4: who sets the Vercel env var (OG_WHOLE_FLYER_MODE), and the owner W3 sign-off at B4 after the real-event check.
