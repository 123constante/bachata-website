# Walk D: what a dancer sees after an organiser edits (REPORT ONLY)

Branch `claude/walk-dancer-view-after-edit`. Code reading + existing vitest + prod counts. No `src/**` change.
Public event page = `src/modules/event-page/bento/BentoPage.tsx` (live via `EventPage.tsx`), data from `useEventPageQuery.ts` -> `event_view_p5`.
P3 saves are `series.upsert` of `default_*` columns (`p3/data/details.ts:136-148`, `prices.ts:68-70`). What `event_view_p5` does with those defaults (and with per-date overrides) lives in the admin repo and was NOT read: every SHOWS below is "the page renders the field if the RPC serves it".

## Field table

| # | P3 field (file:line) | Public event page (file:line) | Public organiser page | Verdict |
|---|---|---|---|---|
| 1 | Name `details.ts:43,138` | title `BentoPage.tsx:605-609` area, `snapshot.event.name` `useEventPageQuery.ts:150` | n/a | SHOWS |
| 2 | About `default_description` `details.ts:140` | `DescriptionBlock` `BentoPage.tsx:483` | n/a | SHOWS |
| 3 | Music `default_music_styles` `details.ts:141` | `MusicStylesRow` `BentoPage.tsx:797` | n/a | SHOWS |
| 4 | Where `default_venue_id` + `default_city_id` `details.ts:143-146` | `snapshot.locationDefault.venue` `useEventPageQuery.ts:299-`, model `buildEventPageModel.ts:203-222`, `venue` tile hidden when no name/address `BentoPage.tsx:344-345` | n/a | SHOWS (series default only; see risk 2) |
| 5 | Ticket link `default_ticket_url` `details.ts:147` | `actions.ticketUrl` via `safeExternalHref` `useEventPageQuery.ts:265`; sticky bar `BentoPage.tsx:836-840` | n/a | SHOWS, but a link that fails `safeExternalHref` silently vanishes (risk 4) |
| 6 | Cover `default_cover_image_url` `details.ts:148` | `event.imageUrl` -> `CoverBlock` `BentoPage.tsx:427,451`; also og:image, JSON-LD `:596` | organiser page uses per-date `occ.cover_image_url` for event cards `OrganiserProfile.tsx:798,817` | SHOWS on event page; STALE-prone on organiser cards (risk 3) |
| 7 | Gallery `default_gallery` `details.ts:149` | `galleryUrls` -> `CoverBlock.tsx:77` (after the cover, deduped) | cards read `photo_url[0]` only `OrganiserProfile.tsx:798` | SHOWS |
| 8 | Instagram `instagram_url` `details.ts:150` | `actions.instagramUrl` `useEventPageQuery.ts:268` -> model `buildEventPageModel.ts:177` | n/a | SHOWS (not proven which tile renders it) |
| 9 | Videos `default_video_urls` `details.ts:151` | only the FIRST PLAYABLE one: `pickPlayableVideo` `BentoPage.tsx:315`, `video` tile hidden otherwise `:390` | n/a | PARTLY HIDDEN: extra videos and non-playable links never show |
| 10 | Group chat `series.set_group_chat` `details.ts:154` | `GroupChatBlock` `BentoPage.tsx:773`, reads `meta_data_public.whatsapp_link` `useEventPageQuery.ts:269`; hidden on past/cancelled `:770` | n/a | SHOWS if the chat command writes `whatsapp_link` (not proven); chat link is not WhatsApp-only in the P3 rule, public name says whatsapp |
| 11 | Payment methods `prices.ts:68` | `eventInfo.paymentMethods` is built (`buildEventPageModel.ts:256`) but `grep` finds NO live importer of `EventInfoSection` and no non-`sections/` use of `eventInfo` | n/a | HIDDEN (saves, never rendered on the live page) |
| 12 | Price rows `pricesCommand` `prices.ts:67` | `snapshot.event.tickets` -> `TicketsBlock` `BentoPage.tsx:762`, only when `flags.publicTicketing` and a type is on sale; pre-ticketing the rows feed JSON-LD only `:632` | n/a | HIDDEN when `publicTicketing` is off or nothing on sale; "It's free" (`free` payment code) has no public render either |
| 13 | See-it-as-dancers link `publicPageOf` `eventPage.ts:407-413` | opens `eventHref({slug})` | n/a | SHOWS; off for draft/archived, paused opens with past dates only |

Organiser public page (`OrganiserProfile.tsx`, `organiserPublicProfile.ts`): reads `organiser_profiles` (`:86`), team from `organiser_team_members` (`OrganiserProfile.tsx:732`), events from rows. It shows avatar/bio/instagram/website (`:117-131`). None of those fields is edited in P3 event screens (they live in `edit-in-place`/organiser profile editing), so the event-edit -> organiser-page link is only the event cards (cover, poster, location).

## Share link
- The only "copy/share my link" in `p3/` is `OnboardingFlow.tsx:1003`, and it copies the ORGANISER page `/organisers/<id>` (after go-live), not the event.
- On the event page the organiser gets "See it as dancers see it" (`eventPage.ts:407`, slug-based, `eventHref`), but no copy/share control for the event link. Dancers' own share sheet exists (`shareTitle`/`shareSubtitle`, `BentoPage.tsx:842-`). Share previews use `og:image` = cover, so a new cover shows in previews only after crawler cache expiry (not verified).

## Ranked risks (worst first, "would an organiser give up")
1. Payment methods and "It's free" save but have no public render (row 11). Organiser sets "pay at door / free", dancers never see it.
2. Venue edit is a SERIES default. If a date has its own venue override (`COALESCE(co.venue_id, e.venue_id)`) the dancer sees the date's place, not the new one. Whether `event_view_p5` applies the COALESCE could not be read from this repo.
3. Cover edit is a series default; organiser-page cards read `occ.cover_image_url` first (`OrganiserProfile.tsx:798`), so dates with their own cover keep the old picture on the organiser page.
4. Ticket link accepted by P3 `linkRules` but dropped by `safeExternalHref` renders no button and no message. P3 and the public filter are two rules (not compared line by line).
5. Price rows invisible while `publicTicketing` is off or no ticket type is on sale (row 12).
6. Only the first playable video shows; extra video links are saved and silent (row 9).
7. Group chat saved but public read is `meta_data_public.whatsapp_link`; unproven that the command fills it (row 10).
8. No "copy event link" in P3; the only copied link is the organiser's, once, at go-live.
9. Paused ("Hidden") event: page still opens with past dates; an edit appears to land on a page nobody is sent to.
10. Name edit shows on the page; page title/OG after cache expiry unverified.

## Existing evidence run
`npx vitest run dancerView.matrix.test.tsx organiserPage.matrix.test.tsx eventPage.matrix.test.tsx`: 3 files, 340 tests passed. These test the link and the organiser page; none renders the event page after a P3 edit (that is the gap this walk found). Phone spec `organiser-hero-owner.phone.spec.ts` and pictures NOT run (no preview server/browser run in this session), so no picture was opened.

## Prod shapes (read-only counts, prod `stsdtacfauprzrdebmzg`)
`event_series_p5` by lifecycle (no_cover / no_venue / no_ticket / no_description / no_slug):
- live 70: 0 / 0 / 16 / 1 / 0
- ended 22: 0 / 0 / 10 / 2 / 0
- paused 2: 0 / 0 / 1 / 1 / 0
- draft 16: 13 / 11 / 15 / 13 / 0
- archived 654: 613 / 601 / 621 / 612 / 611 (not public)
`organiser_profiles`: 50, all live; 2 no avatar, 46 no bio, 0 with no active team member. (No cover column on organiser_profiles; "organiser page with no cover" = no avatar here.)
So live events always have cover and venue today; the visible gap is ticket link (23% of live, 45% of ended) and the organiser bio (92% empty).

## Coverage
13 fields: 7 SHOWS (1,2,3,4,5,7,8; 13 is a link) counting 13 -> 8 SHOWS, 3 HIDDEN (11, 12, and free-flag part of 11), 2 PARTLY (9, 10 unproven), STALE-prone 1 (6 on organiser cards). Strict count: N=13, SHOWS 8, HIDDEN 2 (rows 11, 12), STALE 1 (row 6), PARTLY/UNPROVEN 2 (rows 9, 10).

## Not verified
A real edit then a real public reload after cache expiry (CDN, OG and share previews on a real device), real sign-in, a real phone. `event_view_p5` body and per-date override handling (admin repo) not read. No 390x844 picture opened; the optional phone spec was not written. `sections/` importer proof: only `EventInfoSection` was grepped.

tsc run on this commit: not run (docs-only change, no src touched).

DONE [worker-done dt_ea128ca035ef]
