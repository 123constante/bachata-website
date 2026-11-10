# INVENTORY: event-page Tickets page (rule 1), re-taken on main b328ed6 (after #1493, #1491, #1496, #1500)

Anything marked "none" was searched for and does not exist.

| Area | file:line | What is there now |
|---|---|---|
| Flag | src/lib/featureFlags.ts:82 | `publicTicketing` = `VITE_ENABLE_PUBLIC_TICKETING === 'true'`. Guards everything below. |
| Sticky bar | src/modules/event-page/bento/EventStickyActionBar.tsx:88,104,152-212 | `inSiteTicketing` prop; `inSite = inSiteTicketing && eventId && sells`; probe at 152-154; "Tickets elsewhere" 177-182; `buy-in-site` button 191; external "Get Tickets" 206-212. Fixed bar, `pointer-events-none` wrapper 158. Colour is the old yellow CTA fill (line ~50), NOT the amber bar of the mockup. |
| Sells probe | src/modules/event-page/bento/InSiteTicketProbe.tsx:1-19 | Lazy; reports `sells` to the bar. |
| Bar mounted | src/modules/event-page/bento/BentoPage.tsx:834-846 | `inSiteTicketing={flags.publicTicketing && !over && !occurrence?.isCancelled && !pageModel.page.isPaused}` |
| Old floating button | src/modules/event-page/bento/StickyTicketButton.tsx:114 | Legacy; confirm importer before editing. |
| TicketsBlock | src/modules/tickets/TicketsBlock.tsx:56 (504 lines) | Inline block in the bento grid, lazy (BentoPage.tsx:107), mounted BentoPage.tsx:761-769 when `publicTicketing && ready && !over && !cancelled && !paused`. Types read via `fetchPublicTicketTypes` (ticketCheckoutApi.ts:43). State: typeId/quantity/email/name/terms/submitting/promo (73-86); `?tickets=cancelled` banner 69-71, 216-218; promo 103-134; `onBuy` 172; refusal re-read 198; `onWayForward` 204. NOT a separate page, no symbol tiles, no programme, no chips, no amber bar. |
| Type model | src/modules/tickets/ticketCheckoutModel.ts:9 `MAX_PER_ORDER = 20`; :30 `PublicTicketType`; :95 `availability`; :105 `typesForNight`; :110 `maxQuantity`; :126 `totals`; :171 `disabledReason`; :185 `buyLabel`; :251 `REASON_COPY`; :297 `ThanksOrderState`; :343 `thanksCopy` | Money and checkout logic: DO NOT CHANGE. |
| Thanks page | src/modules/tickets/TicketThanksPage.tsx:22-127; route AnimatedRoutes.tsx:243; path ticketCheckoutModel.ts:18 | States 76-85 (confirmed/checking/none/paid/failed/processing); QR via OrderQrBlock.tsx (82 lines) for signed-in paid at 105-110; back links 115-121. |
| My tickets | src/modules/tickets/MyTicketsPage.tsx:133 `MyTicketsView`, :188 page; model myTicketsModel.ts (`groupTickets` 99, `stateCopy`, `guestNote` 189); route AnimatedRoutes.tsx:233-235; path myTicketsModel.ts:12 | upcoming/past/empty/error/signed-out/loading states. Find-by-email: only a guest note (myTicketsModel.ts:189); no find form (none). |
| Door refused card (#1439) | src/modules/organiser/p3/door/model.ts:17-18 results; :93-100 `wrong_event` ("NOT FOR THIS EVENT"), `not_valid`, `unknown_code`, `not_allowed`, `too_many_attempts`, `no_signal`; rendered DoorScreen.tsx:279 | Organiser side, already built. |
| Venue fields read (event page) | src/modules/event-page/types.ts:200-201 (`floor_type`, `facilities_new`), :306; useEventPageQuery.ts:345-346; buildEventPageModel.ts:213-214 | Only floorType + facilities. NOT read: `parking`, `id_required`, `cloakroom_available`, `bar_available` (all exist on venues: integrations/supabase/types.ts:1938, 9537, 9519). Reading them is the "READ addition" (extend the select + parser; no DB change). Also `bar_available` (types.ts:9517). |
| Programme data | src/modules/organiser/shared/programmeModel.ts; event-page programme block (BentoPage) | Source for the programme block and the length fallback. |
| Chips builder | src/modules/tickets/goodToKnow.ts (new, this branch) | Done + tested. |
| Symbol picker | src/modules/tickets/ticketSymbol.ts (new, this branch) | Done + tested. |

Coverage: 12 areas asked for in the brief or implied by it; 12 located with file:line; 2 sub-items confirmed absent (find-by-email form, venue parking/id/cloakroom read).
