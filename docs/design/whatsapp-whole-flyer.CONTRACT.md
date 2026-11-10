# ACCEPTANCE CONTRACT: whole-flyer link card for every event (DRAFT 2, 2026-11-10, website-50)

Status: DRAFT 2 = DRAFT 1 + review r1 (docs/reviews/whole-flyer-og-contract-r1.md, verdict BLOCK, 2 blockers, 16 further findings, all applied). Round 2 review is next (user-facing public route: two rounds). No build dispatched. Lane: careful; the lead (website-8e) sees the reviewed contract before any build dispatch. Inventory: docs/design/whatsapp-event-preview.INVENTORY.md plus section 4. Run record: ~/.claude/plans/PLAN-og-whole-flyer-rollout-2026-11-10.md.

## 1. Owner decisions (binding; relayed by lead 2026-11-10)
- W1 Who for: people receiving shared links AND organisers sharing them, equally.
- W2 Card content: the flyer only. No text, no logo. A blurred, darkened backdrop of the same flyer for wide AND tall flyers. Nothing of the flyer is cut off.
- W3 Rollout: whole-flyer becomes the default for ALL events only after it is built and checked on real events (BOS Majorca and a few others). No instant switch-on at merge.
- W4 (earlier, owner phone check 2026-11-10) The test tall card (PR #1517, ?ogtest=tall) looked good in WhatsApp.

## 2. Design choices (lead-reversible, logged)
- D1 One renderer, one rule: the whole flyer is drawn fit:inside, centred, on a cover-scaled, blurred (sigma 22), darkened (x0.6) copy of itself (the #1517 treatment). Canvas size follows the flyer: width 960; height 960 / r with r clamped to [0.8, 1.91]; so tall flyers give 4:5 at most, squarish flyers give about 1:1 to 1.2:1, wide flyers give up to 1.91:1 (960x503). A flyer wider than 1.91 (2 of 33 sampled: 2.28, 3.14) gets blurred bars top and bottom; none of it is cropped. The old rule that flyers with r >= 1.3 keep the 1200x630 branded card is REMOVED for the new mode. Decided (r1 note 12): 960 wide for every ratio, one rule. Measured worst case (pure noise, so the ceiling not a typical flyer): 1200x628 fits at q82 (286 KB) but a 1200x1500 tall card does not fit even at q58 (393 KB), so one width keeps the ladder working. If wide cards later need to be sharper, 1200 only for r >= 1.3 is allowed and fits.
- D2 Declared sizes (r1 finding 3). og:image:width and og:image:height are the REAL pixel size of the card, never a constant. For a BAKED card the size is written in the R2 key (for example <id>-<occ>-<cover16>-wf1-960x1200.jpg) and resolveOgCardImage parses it and declares it, with NO fetch (og_render has no size column and adding one is SQL, forbidden by D10). Only the live, not-yet-baked path may fetch and measure the flyer, under a stated time budget; on a miss it declares the size of the card it actually points at and never points at a whole-flyer URL while declaring 1200x630. In mode on this keeps event page views from fetching and decoding a flyer each time.
- D3 Mode switch (r1 findings 10, 11, 16). One env var OG_WHOLE_FLYER_MODE with exactly four values: off (today, default), test (only ?ogtest=whole-flyer), allowlist (named events in OG_WHOLE_FLYER_EVENT_IDS), on (every event). Any other value, wrong case (On) included, means off; allowlist with no ids behaves as off. Parsed once at module load (split, trim, lower-case, UUID check), never per request, like OG_BRANDED_CARD_ENABLED; a Vercel env change plus redeploy is the switch AND the rollback. ONE function ogLayoutFor(kind, entityId) is the only owner of the choice and is called by event.tsx, festival.tsx, api.og.card and api.og.bake, so the page meta, the card route and the bake route can never disagree for an entity. The allowlist holds public_event_id (what og_render.entity_id and the page use); an occurrence follows its series. For an entity on whole-flyer the old branded card is NOT used. The #1517 test hooks are replaced: layout=tall is removed in B1 (its etag segment stays reserved) and ?ogtest=tall becomes ?ogtest=whole-flyer.
- D4 Versioned identity and the read rule (r1 BLOCK findings 1 and 2). The renderer version (for example wf1) lives ONLY in the R2 object key and the etag. It is NOT put in og_render.cover_hash: that value is computed in SQL by set_og_image_v1 from _og_cover_token and compared by get_og_image_v1 with the cover filename token, so changing it needs SQL (D10) and would make every row stop matching. READ RULE (B1 acceptance test, mode x key-segment matrix): resolveOgCardImage parses the layout segment and size from the baked URL key and ACCEPTS the baked URL only if that segment equals the layout ogLayoutFor() picks for this entity right now; otherwise it uses the live /api/og/card URL. Consequences: mode off after the backfill serves the live branded card at once and declares 1200x630 (no size mismatch); a re-run of the backfill in mode off re-bakes the old layout and re-points the rows; the old R2 objects are orphaned (bake.tsx says an unreferenced object is left) and rollback therefore restores the OLD LOOK by live render, not by the old object. The 67 ready rows that are not backfill targets keep their old object, and the read rule makes that safe.
- D5 Cache (r1 finding 5). Two layers: the origin (api.og.card.tsx:123 sends max-age=3600 for the test card) AND Cloudflare in front of Vercel (Free plan, docs/ops/cloudflare-purge.md). The likely cause of the 4 h header seen on prod is the Cloudflare Browser Cache TTL (default 4 h) overriding a lower origin max-age unless Respect existing headers is on; the zone setting itself is NOT VERIFIED. A1 reads that setting. The 1 h ceiling is asserted on the response AS RECEIVED through www. (not on the origin). If the zone keeps 4 h, a Cloudflare cache rule for /api/og/card is needed or the 1 h is not achievable. Until mode is on for everyone, at most 1 hour; one week after the all-events flip with no defect the long cache returns.
- D6 Size ceiling (r1 finding 4). 300 KB enforced AT RENDER; JPEG only, never WebP. Ladder q82, q74, q66, then a new q58 rung (measured on a pure-noise 1536x1920 source at 960x1200: q82 435 KB, q74 334 KB, q66 267 KB, q58 217 KB, so the #1517 comment that q74 gives about 287 KB does not hold for noisy flyers; real flyers are smaller). The card SIZE stays fixed once declared. If even q58 is over, serve the same-size card with the marker X-OG-Fallback: over-budget (the guard reds); NEVER switch to a 1200x630 card under a whole-flyer declared size. B1 changes the silent over-budget return at ogCardRender.ts:631-636.
- D7 Backfill (r1 findings 7, 8). The existing scripts/backfill-og-images.mjs has no batch, limit or id filter and bakes EVERY og_render_targets_v1 target concurrently: 334 targets today (325 event of which 238 are occurrences, plus 9 festival), against 401 ready rows (67 ready rows are not targets and are never re-baked; D4 makes that safe). B1 therefore adds --ids and --limit to the script. In allowlist mode it bakes only the allowlisted ids; batches of at most 25; after each batch a read-only count of ready/error rows. Prod trigger trg_og_scrape_on_ready on og_render fires a Facebook re-scrape for every row that turns ready: a batch of 25 means 25 scrapes; after each batch check scraped_at and scrape_attempted_at read-only. The 23 error rows are retried once, then left for review. No SQL: the write is the same og_render upsert via set_og_image_v1 that the bake route already uses; A1 proves it by reading the route and the function.
- D8 Title, date and venue are not on the card, so the known gap "an edit does not re-bake" disappears for whole-flyer cards, PROVIDED the whole-flyer key and etag do NOT fold in ogFactsTag (r1 finding 10). A cover or poster change still re-bakes (existing triggers).
- D9 Guard (r1 finding 6). Today scripts/check-og-images.mjs checks only that og:image:width is PRESENT (line 463), has no Cache-Control check, and HEALTHY_BAKED_KEY_RE (line 407) would red every new key. D9 adds: (1) declared width and height EQUAL the decoded JPEG size; (2) Cache-Control as received is at most 3600 while the mode is not on (this is the check that would have caught the #1517 surprise); (3) HEALTHY_BAKED_KEY_RE accepts the new segment and the size parsed from the key equals the declared size; (4) ratio within [0.8, 1.91], at most 300 KB, JPEG, no fallback marker. Mutation fixtures that must each fail the guard: declared 1200x630 over a 960x1200 body; a text fallback with the marker stripped; WebP; a 3:1 card; a whole-flyer key served while mode is off; Cache-Control 14400.
- D10 No new public route, no new table, no new SQL. Holds only with the D2 (size in the key), D4 (version in the key, read rule) and D7 (--ids, --limit) designs above. If A1 finds it needs one, it stops and returns to the lead.

## 3. Person types
P1 someone who receives the link in WhatsApp (iPhone or Android). P2 someone who receives it in another app (iMessage, Facebook, Telegram, X, Slack). P3 the organiser who shares their own event. P4 the operator (this team): runs the backfill, flips the mode, rolls back. P5 a crawler or the daily guard (WhatsApp user agent, no cookies). P6 a person who only opens the event page (never sees the card; included to prove the page is unchanged: R8).

## 4. Data shapes (flyer) with PROD counts (read-only, project stsdtacfauprzrdebmzg, 2026-11-10)
og_render rows (re-run by the reviewer, identical): event ready 392 (392 with an image), event error 23 (no image, last updated 2026-10-21), festival ready 9. og_render_targets_v1() returns 334 targets (event 325 of which 238 occurrences, festival 9) against 401 ready rows (298 with an occurrence); 253 distinct cover_hash over the 401 ready rows. Live series: 55 recurring or course, 20 one-off or festival live (see pause-series survey); many occurrences of one series share one cover, so distinct covers are far fewer than rows.
Sample (author, 2026-11-10): 90 baked rows chosen by md5 order gave 34 distinct cover URLs; 33 measured (1 fetch error). The reviewer could fetch only 3 of its 30 (its sandbox blocks the media host) and measured 1200x1200, 459x587 and 721x847, consistent with these buckets but too few to re-check the distribution. Ratio w/h of the 33: under 0.6 very tall 4; 0.6 to 0.8 tall 5; 0.8 to 1.0 portrait or square-ish 6; 1.0 to 1.3 square or landscape 10; 1.3 and over wide 8 (1.59, 1.6, 1.78, 1.78, 1.82, 1.82, 2.28, 3.14). Range 0.56 to 3.14. Pixels: short side 373 to long side 1920. Largest source file 318 KB. All sampled sources are WebP or JPEG.

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
| F11 | festival | 9 ready rows; the festival page declares a fixed 1200x630 in seoMeta.ts:52 and festival.tsx:107 | branded card | same whole-flyer rule, B1 must also change festival.tsx and seoMeta.ts to take the size from the key (D2); otherwise mode never applies to kind=festival and F11 is out of scope until a named later slice |
| F12 | already baked (R2 object exists) | 392 events + 9 festivals | old baked card served by get_og_image_v1 | re-baked in D7 batches; until then the old one stays |
| F13 | kind=image card (dancer, venue, other entities) | route supports kind=image | unchanged | OUT OF SCOPE, unchanged (R5) |
| F15 | PNG, possibly transparent | 1 of 30 sampled cover URLs ends in .png | n/a | transparent flattened before the darken (ogCardRender.ts:612-615); fixture |
| F16 | animated GIF or WebP | not seen | n/a | first frame only (ogCardRender.ts:589-590); fixture |
| F17 | CMYK or 16-bit source | not seen | n/a | no fixture today: B1 adds one |
| F18 | EXIF-rotated flyer | not seen | n/a | handled by .rotate() (ogCardRender.ts:591); fixture |
| F19 | venue image or other image the card could use instead of the flyer | card source differs from the page v= token source | n/a | R5: whole-flyer mode only applies to a cover; B1 asserts it never uses a different image than the page token |
| F14 | occurrence-specific card (the occ parameter of one night of a series) | route supports occ | branded card of that night | same whole-flyer rule; occ stays in the etag |
Honest limit: link previews are cached by the receiving app (WhatsApp, Facebook) per URL for days; a link already shared keeps its old picture until the app refreshes it. We cannot purge WhatsApp. Journey K13 asserts only that the old link still shows A card (not broken), and new shares show the new one.

## 5. Journeys
K1 share an event link in WhatsApp (iPhone and Android). K2 share the link in another app (iMessage, Facebook, Telegram, X, Slack). K3 organiser publishes an event with a flyer and shares it at once. K4 organiser replaces the flyer: card refreshes. K5 event with no flyer. K6 flyer cannot be fetched or is corrupt. K7 title, date or venue edited after the card was made. K8 allowlist stage: card is whole-flyer only for named events. K9 flip the default to whole-flyer for every event. K10 rollback to the current cards. K11 backfill re-bakes the already-baked events. K12 the daily OG guard runs against the new cards. K13 a link already shared before the change.

## 6. Slices (sequenced)
- B0 docs: this contract, inventory, review.
- B1 renderer, read path, backfill script and guard (careful, Website only, after the contract is accepted): whole-flyer card for the wide range in app/lib/ogCardRender.ts (extend the #1517 builder, do not fork it); ogLayoutFor() and the D3 mode env; D2 size and D4 version in the R2 key and etag, with the read rule in resolveOgCardImage (app/detailLoader.ts:318-337); festival.tsx and seoMeta.ts (or F11 declared out of scope); D5 header fix; D6 ceiling and the over-budget marker; D7 --ids and --limit in scripts/backfill-og-images.mjs; D9 guard change with the mutation fixtures; removal of layout=tall. Tests: table-driven over the F1 to F8 and F15 to F18 fixtures with a REAL sharp render (not mocked), asserting dimensions equal the declared ones, <= 300 KB, JPEG, whole flyer present (a pixel check that the flyer edges are on the canvas), no text. Mode off must be byte-identical to today (golden test).
- B2 staged check (no code): lead or owner sets OG_WHOLE_FLYER_MODE=allowlist with BOS Majorca and 4 more real events (one of each: very tall, tall, square, wide, ultra wide); read-only walk of each card, then owner WhatsApp check on iPhone and Android.
- B3 backfill batches (D7) in allowlist or on mode, with the read-only count after each batch.
- B4 flip to on (the owner decision W3 happens here: "default for all events only after checked"), then one week watch, then long cache.
- Rollback, per transition (r1 finding 17; the D4 read rule is a B1 acceptance test, a mode x baked-key-segment matrix): off to test and test to off: no rows change, safe. off to allowlist before B3: named events get the live whole-flyer card because the baked branded object fails the read rule. allowlist to off before B3: safe. After B3 (rows point at whole-flyer objects): to off the read rule serves the live branded card at once; re-running the backfill in mode off re-bakes and re-points the rows. on to off after the backfill: same. The old look is restored by live render, not by the old R2 objects.

## 7. Not verified
Prod value of OG_BRANDED_CARD_ENABLED is ON (seen on prod: BOS Majorca card is the cropped branded card) but the Vercel setting itself is not visible to us. The sample is 33 covers, not all ~400. What WhatsApp, iMessage, Facebook, Telegram, X and Slack each do with a card that is not 1.91:1 (WhatsApp tall card checked by the owner on one phone; Android and the other apps not). Why the tall card header showed max-age=14400. Whether the daily guard needs the WhatsApp UA change. The Cloudflare zone Browser Cache TTL (D5 is an inference). Real flyers are smaller than the pure-noise worst case used for the size ceiling. Render time on Vercel (the reviewer measured 0.6 to 1.8 s locally for a 1920 px noise source; B1 asserts a ceiling for the live render). Whether the festival cover has a re-bake trigger (none named og on the festival tables; festival rows last updated 2026-09-14). Real-phone check of every shape.

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
| Journey | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 | F9 | F10 | F11 | F12 | F13 | F14 | F15 | F16 | F17 | F18 | F19 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K1 share an event link in WhatsApp (iPhone and Android) | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |
| K2 share the link in another app (iMessage, Facebook, Telegram, X, Slack) | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |
| K3 organiser publishes an event with a flyer and shares it at once | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | R5 | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |
| K4 organiser replaces the flyer: card refreshes | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |
| K5 event with no flyer | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 | yes | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 |
| K6 flyer cannot be fetched or is corrupt | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 | yes | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 | R5 |
| K7 title, date or venue edited after the card was made | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |
| K8 allowlist stage: card is whole-flyer only for named events | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | yes | yes | yes | yes | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |
| K9 flip the default to whole-flyer for every event | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | yes | yes | yes | yes | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |
| K10 rollback to the current cards | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | yes | yes | yes | yes | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |
| K11 backfill re-bakes the already-baked events | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes | R7 | R7 | R7 | R7 | R5 |
| K12 the daily OG guard runs against the new cards | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | yes | yes | yes | yes | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |
| K13 a link already shared before the change | yes | yes | yes | yes | yes | yes | yes (R6 fixture) | yes (R6 fixture) | R5 | R5 | yes | yes | R5 | yes | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | yes (R6 fixture) | R5 |

13 journeys x 19 shapes = 247 cells: yes 170 (of which 62 fixture-only, 108 on real data), coded 77, GAP 0.

## 9. GRANT list
None. No SQL, no new table, no new route (D10). If review or A1 finds a new grant, the contract is wrong and goes back to the lead.

## 10. Owner decisions still open
None that block the contract. For the lead at B2/B4: who sets the Vercel env var (OG_WHOLE_FLYER_MODE), and the owner W3 sign-off at B4 after the real-event check.
