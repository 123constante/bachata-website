# INVENTORY: public organiser page "Next nights" + "Past nights" (2026-11-06)
Source: origin/main of Website (W) and admin (A). Read-only. W = src/pages/OrganiserProfile.tsx unless stated. Row = src/components/events/EventRow.tsx.

## 1. NEXT NIGHTS (W:1364-1401)
| # | Element / state | Today | file:line |
|---|---|---|---|
| 1 | Section wrapper | section id="upcoming", only when upcomingListItems.length>0 | W:1366 |
| 2 | Header title | "Next nights", serif 16px | W:1370, style W:1160 |
| 3 | Header count | "{N} date(s)" = individual occurrences (a series counts all its dates) | W:1372, calc W:984-985 |
| 4 | Owner slot | eip 'create-event' link beside count (owner only) | W:1373 |
| 5 | Card (single) | EventRowCard: Link to /event/:id?occurrenceId=:occ (or /event/:id if no occ id) | W:1383, href W:441 |
| 6 | Card (series) | button (onClick) opening SeriesDatesSheet; NOT a link | W:1385-1391, Row:119 |
| 7 | Series grouping | groupByEventId, threshold 3: 3+ upcoming dates sharing an event id = one series card; 1-2 stay singles | W:958-977, src/lib/eventListGrouping.ts:17-41 |
| 8 | Series key caveat | grouping key is event_id from the calendar RPC. The events RPC returns id = COALESCE(legacy_event_id, series id), plus series_id separately; occurrences join on event_id, so legacy id where one exists, else series id | A supabase/migrations/20261107280000_m5_get_organiser_public_events_p5_v1.sql:23-24; W:1561 (openSeriesEventId) |
| 9 | Flyer thumbnail | 52x52 rounded-xl, img object-cover, optimizedImageUrl(url,160), lazy, alt="" | Row:56-74 |
| 10 | Image source (single) | occ.cover_image_url, else occ.photo_url[0], else event poster_url | W:798 |
| 11 | Image source (series card) | first date's resolved poster (dates[0]) | W:973 |
| 12 | No-flyer fallback | gradient by row index (4 gradients) plus dark overlay | Row:6-11, 33-34, 76-84 |
| 13 | Date badge | 26x26 box over flyer top-left: day (11px white) + MON (6px gold uppercase); series card shows FIRST date | Row:86-100, W:430 |
| 14 | Title | name, 14px bold, single-line truncate; series uses first date's name | Row:104-106, W:972 |
| 15 | Meta line | single: countdown . venue (location, else city) . time; series: countdown . location (no time); 11.5px truncate | W:439, W:1387 |
| 16 | Countdown wording | Tonight / Tomorrow / "in N days" (<7) / "next week" (<14) / "in N weeks". No "THIS SUNDAY" flag exists on origin/main (grep found none) | W:218-227 |
| 17 | Series pill | "{N} dates" gold pill left of chevron, 10px | W:1388, Row:116-120 |
| 18 | Chevron | ChevronRight 18px on link and button rows alike | Row:121 |
| 19 | Card chrome | rounded-2xl, 1px border, p-3, hover tint; list gap-2 | Row:127-131, W:1377 |
| 20 | Time shown | single only; suppressed for date-only / 00:00 | W:228-236 |
| 21 | Collapse | first 3 ITEMS (UPCOMING_VISIBLE=3); button "Show all {N} dates" / "Show fewer"; aria-expanded; scrolls back if above | W:402, 1394-1398 |
| 22 | Series sheet | Drawer, title "{name} - {N} dates", max 60vh list of EventRow per date (each a link to the event page with occurrenceId) | src/components/events/SeriesDatesSheet.tsx:28-52, W:1554-1559 |
| 23 | Tap targets | whole card; series -> sheet; single and sheet rows -> event page; "Show all" min 44px | Row:127, W:1162 |
| 24 | Empty: no nights at all | "No dates announced yet." + pill link "Browse upcoming nights" (-> /parties) + owner slot 'create-first-event' | W:1404-1411, W:376-380, src/modules/profile/organiserEmptyState.ts:44 |
| 25 | Empty: past-only | same line, own section if no past rows, else inside Past header area | W:1415-1425, 1436-1441 |
| 26 | Error | FeedErrorLine "Couldn't load dates." + RetryButton, role=status; empty states suppressed while a feed failed | W:381-396, 1365, 1125-1135 |
| 27 | Loading | no skeleton found for this block; section absent until data (emptyKind null while loading) | W:1125-1135 (not fully traced) |
| 28 | Excluded | cancelled occurrences skipped; only what the calendar RPC returns for the future window | W:790-793 |
| 29 | Legacy fallback | events with no occurrence rows: base date, upcoming if >= today; skipped when either feed errored | W:826-840 |
| 30 | Sort | ascending by wall-clock start | W:845-848 |
| 31 | Impressions | trackImpression(eventId) on each row | W:1383-1386 |

## 2. PAST NIGHTS (W:1427-1491)
| # | Element / state | Today | file:line |
|---|---|---|---|
| 1 | Section | section id="past", when pastEvents.length>0 | W:1430 |
| 2 | Title | "Past nights"; "Recently hosted" when emptyKind==='past-only' | W:1432 |
| 3 | Count | "{N} hosted" (cancelled excluded) | W:1433, W:803-806 |
| 4 | Year group | native details; first year open; rounded-2xl border; summary min 44px | W:1445-1453 |
| 5 | Year label | "YYYY . N NIGHT(S)" 12px, uppercase via CSS; gold chevron (static) | W:1449-1451 |
| 6 | Row | thin row, NOT the card: 28x28 flyer, date "EEEE d MMM" (132px, nowrap, "TBA" if none), name truncated; min 44px; link to /event/:id?occurrenceId= | W:1456-1473 |
| 7 | Flyer | cssUrl(poster_url, srcWidthFor(28)) background; fallback PAST_GRADS gradient by index | W:1465, W:149 |
| 8 | No series grouping | every past occurrence is its own row (deduped by occurrence id) | W:808-819 |
| 9 | Per-year cap | PAST_ROWS_PER_YEAR=8; "Show all {N} nights in {YYYY}" / "Show fewer"; 12px | W:399, 1474-1482 |
| 10 | Years cap | PAST_YEARS_VISIBLE=3; "Show earlier years (N)" / "Show fewer years" | W:1485-1489 |
| 11 | Window | 10 years back to tomorrow, p_include_past=true | src/modules/profile/organiserPublicProfile.ts:150-160 |
| 12 | Past rule | server is_past flag (today's ended nights count as past); cancelled skipped | W:803-806 |
| 13 | Empty / error | "No dates announced yet." + Browse link (past-only); FeedErrorLine "Couldn't load past dates." | W:1436-1441, 1428 |

## 3. Data hooks / RPCs (page load, 5 min staleTime)
- fetchOrganiserEvents -> rpc get_organiser_public_events_v1 (id, series_id, name, date, start_time, poster_url, location = default venue name, city); live + ended series only. W:698; organiserPublicProfile.ts:109; A migration 20261107280000_m5_...:14-43.
- fetchOrganiserFutureOccEvents -> get_organiser_calendar_events_v1(p_organiser_id) (name, photo_url[], cover_image_url, location, instance_date, start_time, occurrence_id, is_cancelled, is_past ...). organiserPublicProfile.ts:137; A migration 20270301110000_p3_a1_forward_calendar_v1.sql:179 (later body 20270302010000_p3_a1_calendar_perf_v1.sql).
- fetchOrganiserPastOccEvents -> same RPC with p_from / p_to / p_include_past. organiserPublicProfile.ts:150.
- Errors throw (throwFeedError) so a failure is never shown as empty: organiserPublicProfile.ts:119-130.
- Types EventRow / OrgOccRow: organiserPublicProfile.ts:22-47.

## 4. Admin side (where each field is edited)
- Flyer/cover: EventImagesField (cover + gallery) in DetailsPanel: A components/events/editor-v2/panels/DetailsPanel.tsx:379 (cover), panels/EventImagesField.tsx; per-date override chip DetailsPanel.tsx:412-420; saved as cover_image_url (EventEditor.tsx:1598). The public events RPC reads series poster_url else default_cover_image_url (migration above:31). NOT confirmed: which admin control writes poster_url vs default_cover_image_url.
- Series/event name: DetailsPanel.tsx:320 Field "Event name" (id v2-name); per-date name override exists (occ.name || e.name, W:799).
- Venue: DetailsPanel.tsx VenuePicker (import :41); per-date venue override A components/events/editor-v2/date/OccurrenceDateDrawer.tsx:340-355.
- Dates/time: components/events/editor-v2/WhenSection.tsx; per-date time/venue drawer OccurrenceDateDrawer.tsx; cancel a date: date/DateCancellationCard.tsx (cancelled dates hidden publicly).
- Series lifecycle: LifecycleMenu.tsx (live and ended series are both listed publicly).
- Organiser-side lists: components/admin/organiser-studio/OrganiserEventsTab.tsx; components/events/EventList.tsx (not read in detail).

## 5. Public page
/organiser/:id -> src/pages/OrganiserProfile.tsx. Order: hero, stats, Get in touch, Team, About, Next nights, Past nights (W:1287). SSR loader prefetch in app/routes/organiser.tsx (per comment W:715; not opened).

## 6. Field table
| Field | Admin source | Website render | In mockup? |
|---|---|---|---|
| Flyer image (series/date) | DetailsPanel.tsx:379; EventImagesField.tsx | W:798, Row:56-74 (next); W:1465 (past) | TO FILL |
| No-flyer gradient | n/a (derived) | Row:6-11,76; W:149 | TO FILL |
| Series/event name | DetailsPanel.tsx:320 | Row:104; W:972; W:1469 | TO FILL |
| Per-date name override | occurrence override (not traced) | W:799 | TO FILL |
| Date badge DD MON | WhenSection.tsx | Row:86-100; W:430 | TO FILL |
| Countdown text | derived | W:218-227, 439 | TO FILL |
| "THIS SUNDAY" flag | none found | none on origin/main | TO FILL (decide if new) |
| Venue / location | DetailsPanel VenuePicker; OccurrenceDateDrawer.tsx:340 | W:439, W:1387 | TO FILL |
| Time of day | WhenSection.tsx | W:228; W:439 (single only) | TO FILL |
| "N dates" pill | derived | W:1388; Row:116 | TO FILL |
| Header count "N dates" | derived | W:1372 | TO FILL |
| Chevron | n/a | Row:121 | TO FILL |
| Title truncation | n/a | Row:104; W:1469 | TO FILL |
| Show all / fewer (next) | n/a | W:1394 | TO FILL |
| Series sheet (drawer) | n/a | SeriesDatesSheet.tsx | TO FILL |
| Past header "N hosted" | derived | W:1433 | TO FILL |
| Past year summary + chevron | derived | W:1449 | TO FILL |
| Past row (thumb, long date, name) | derived | W:1456-1473 | TO FILL |
| Per-year "Show all N nights in YYYY" | n/a | W:1478 | TO FILL |
| Show earlier years | n/a | W:1487 | TO FILL |
| Empty "No dates announced yet" + Browse link | n/a | W:1407-1408 | TO FILL |
| "Recently hosted" heading variant | n/a | W:1432 | TO FILL |
| Error line + retry | n/a | W:381 | TO FILL |
| Cancelled date hidden | DateCancellationCard.tsx | W:790, 805 | TO FILL |
| Owner slots (create event) | n/a | W:1373, 1410 | TO FILL |

## Not confirmed
- Copy from the brief ("No nights listed yet", "No upcoming nights", "THIS SUNDAY") is not on origin/main. Empty copy is "No dates announced yet"; the upcoming collapse says "dates", the past one says "nights".
- Loading skeleton for the two blocks; which admin control writes series poster_url; app/routes/organiser.tsx loader; stats-strip links into #upcoming/#past.
- git fetch printed one ref error (raffle branch); origin/main itself was readable.

coverage count: TO FILL of 25 fields drawn
