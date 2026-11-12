# INVENTORY: organiser dashboard (before design)

Step 0 for the new organiser dashboard: every field, state and option the organiser area and the
public organiser page have TODAY, each cited `path:line`, mapped to the contract the 3 mock options
must meet. Read at branch `claude/profile-dash-organiser-designs` (= origin/main), 2026-11-12.
Read-only: no app code, no DB reads or writes.

Contract keys: **O1** no events / no team (Next action card, Share my page: copy, WhatsApp,
Instagram caption; empty states say what to do). **O2** upcoming nights (per-night card: Going from
event_attendance, opens = every open by everyone, link clicks by type ticket/share/whatsapp/directions;
positive-only; zero = suggested action; a cancelled night). **O3** selling via us (Tickets sold tile
only then). **O4** profile completeness bar + next step; Rating and Level rating always shown; city
average only with 5+ organisers in the city. **Vis** = visible to the whole team. EXCLUDED by contract:
page-view tiles, chart, enquiries, saves, weekly summary, source split on opens. The page opens line
comes from `profile_view_events`.

The admin repo (`bachata-admin-11april`) is NOT readable in this session: admin items are cited via
the Website doc that describes them, and every claim not checkable here is a GAP.

Prototype paths are short: `org-proto-*.md` = `origin/brief/profile-dash-organiser-designs:docs/briefs/org-proto-*.md`.
All their numbers are placeholders (000).

---

## 1. Website organiser area

| # | Item (field / state / option) | Cited at | Contract map |
|---|---|---|---|
| W1 | Legacy "Organiser Hub": 5 tabs Overview / Operations / Content / Contact / FAQ (mounted for activeRole organiser) | src/components/profile/OrganiserDashboard.tsx:99-106; src/components/profile/ProfileEntryRouter.tsx:148 | EXCLUDED: legacy surface superseded by P3; tab set is not in the contract |
| W2 | Legacy counts Events N / Drafts N / Published N from boolean `is_published` | src/components/profile/OrganiserDashboard.tsx:108,147 | EXCLUDED: binary draft flag disagrees with the real lifecycle (W12); replaced by W11 |
| W3 | Legacy empty "No events created yet." + Add event | src/components/profile/OrganiserDashboard.tsx:115-116 | O1 |
| W4 | Area door: P3 `/account/p3` vs R1 `/account/o`, `?o=` page key, `?legacy=1` until 7 Dec 2026 | src/lib/organiserAreaHome.ts:18-44 | EXCLUDED: routing, not a dashboard field (the new dashboard mounts at `organiserAreaHome()`) |
| W5 | Page scope picker (PageHeader, one page of several; `?o=`) | src/modules/organiser/p3/screens/HomeScreen.tsx:71; src/modules/organiser/p3/screens/StatsScreen.tsx:40-41 | Vis |
| W6 | No page yet: onboarding (find, claim, create) in the dancer home; P3 Home redirects to Start | src/components/account/OrganiserOnboardingPanel.tsx:24-32; src/modules/organiser/p3/screens/HomeScreen.tsx:55-63 | O1 |
| W7 | Home loading / error + Retry states | src/modules/organiser/p3/screens/HomeScreen.tsx:39-53 | O1 (shared states, every option) |
| W8 | Claim / create confirmation line, ClaimNotice, GraceBanner | src/modules/organiser/p3/screens/HomeScreen.tsx:66-72 | O1 |
| W9 | Page has no events: "No events here yet" + Add event (+ "or switch to another page") | src/modules/organiser/p3/screens/HomeScreen.tsx:76-85 | O1 |
| W10 | Next up hero: thumb, kind chip, status tag, when, name, place, "This date is different from usual", night Going | src/modules/organiser/p3/screens/HomeScreen.tsx:97-113 | O2 |
| W11 | Event status keys `live / hidden / finished / draft / review / warn`; labels Live, Hidden, Finished, Draft, All classes done | src/modules/organiser/p3/model/status.ts:8,25-39; src/modules/organiser/p3/model/labels.ts:74-76,103-104 | O2 |
| W12 | Stored lifecycle values `draft, pending_review (In review), live, rejected (Changes needed), paused (Paused), ended, archived` | src/modules/organiser/shared/selfServeApi.ts:468-476 | O2 |
| W13 | Organiser PAGE status draft / live / paused / ended / archived + newEventBlock "cannot take new events. Ask the Bachata Calendar team." | src/modules/organiser/shared/organiserStatus.ts:23-57 | O1 (Next action when the page cannot take events) |
| W14 | seriesLife: live + 0 upcoming = Finished, or "Nothing coming up" (recurring) + "Open it to see how to add dates." | src/modules/organiser/shared/lifeLabel.ts:14-22,45-54 | O2 |
| W15 | No Next up: 6 advice cases (warn, draft, paused, review, all happened, nothing) each with ONE control (Events or New event) | src/modules/organiser/p3/model/status.ts:54-73; src/modules/organiser/p3/screens/HomeScreen.tsx:16-24 | O1 / O2 (zero = suggested action) |
| W16 | Needs you items `photo / dates / draft` with title + detail | src/modules/organiser/p3/data/home.ts:194-243; src/modules/organiser/p3/screens/HomeScreen.tsx:120-137 | O1 (Next action card source) |
| W17 | R1 job kinds `change, add, cancel, no_dates_left, join_request, stale_draft, go_live, no_cover, create_first_event, add_manager` | src/modules/organiser/jobs/homeJobs.ts:16,148 | O1 |
| W18 | R1 to-do heading / empty "Nothing to do right now. To put something on, tap New event below." | src/modules/organiser/home/homeView.ts:16-17 | O1 |
| W19 | Home "Last 30 days" views tile (organiser_series_stats_v1) + "No views yet" | src/modules/organiser/p3/screens/HomeScreen.tsx:139-157 | EXCLUDED: page-view tile |
| W20 | Views per series per London day `views_by_day` (no occurrence id) | src/modules/organiser/p3/data/stats.ts:11-16,62-66 | O2 (opens source; per-night only by date, see GAP-4) |
| W21 | Going total tile: upcoming not-cancelled nights (get_my_organiser_going_total_v1: going_total, nights, events) | src/modules/organiser/p3/screens/parts.tsx:93-99; src/modules/going/goingRpc.ts:30,283 | O2 |
| W22 | Night Going summary + people sheet (get_my_series_going_v1: occurrence_id, going_count, people, is_cancelled) | src/modules/organiser/p3/screens/P3Going.tsx:31-62; src/modules/going/goingRpc.ts:47-50 | O2 |
| W23 | Cancelled night Going copy "This date is cancelled" | src/modules/going/goingCopy.ts:92,143 | O2 (cancelled night) |
| W24 | Going zero copy "Nobody has said they're going yet" / "No one going yet" + share hint | src/modules/going/goingCopy.ts:91,100-101 | O2 (zero = suggested action) |
| W25 | Going gate: P3 + GOING_CHECKIN_ENABLED; a contributor (`not_organiser`) sees nothing | src/modules/organiser/p3/screens/P3Going.tsx:11,21-22 | Vis (conflict, GAP-6) |
| W26 | Tickets sold tile: only when > 0; owner also sees gross pence, manager the count | src/modules/organiser/p3/tickets/GetPaid.tsx:271-287 | O3 |
| W27 | Get paid prompt (flag organiserTicketing) | src/modules/organiser/p3/screens/HomeScreen.tsx:118 | O3 |
| W28 | "All your events" first 4 current + "See all N"; "Nothing current" | src/modules/organiser/p3/screens/HomeScreen.tsx:163-179 | O2 |
| W29 | Stats range Today / 7 days / 30 days | src/modules/organiser/p3/screens/StatsScreen.tsx:14,46-54 | EXCLUDED: chart / page-view controls |
| W30 | Stats views total tile | src/modules/organiser/p3/screens/StatsScreen.tsx:109-112 | EXCLUDED: page-view tile |
| W31 | Visitors and "From your link" tiles + visitor help line | src/modules/organiser/p3/screens/StatsScreen.tsx:123-130,144-146 | EXCLUDED: page views / source split |
| W32 | Guest list sign-ups tile (non-zero only) | src/modules/organiser/p3/screens/StatsScreen.tsx:131-136 | EXCLUDED: not in contract (enquiry-like; Going is the attendance figure) |
| W33 | Stats Tickets sold tile (non-zero only) | src/modules/organiser/p3/screens/StatsScreen.tsx:137-142 | O3 |
| W34 | Views chart + "Show as a table" toggle | src/modules/organiser/p3/screens/StatsScreen.tsx:16-33,171-196 | EXCLUDED: chart |
| W35 | By event list: views bar + series Going | src/modules/organiser/p3/screens/StatsScreen.tsx:197-210 | O2 (Going part; the views bar is EXCLUDED) |
| W36 | Stats empty states: none in range / Put an event live / share link reasons | src/modules/organiser/p3/screens/StatsScreen.tsx:150-168 | O1 (empty says what to do) |
| W37 | analytics_v2 `link_taps` map (keys from the server), `link_taps_from_your_link` (parsed, never shown) | src/modules/organiser/p3/data/analyticsV2.ts:10-18,44-53 | O2 (clicks by type; series total, not per night: GAP-4) |
| W38 | Analytics hidden on refusal (owner / manager of the SERIES only) | src/modules/organiser/p3/data/analyticsV2.ts:117-133 | Vis (conflict, GAP-6) |
| W39 | Share link card: Copy link; states loading / off / noCode / noEvent / noRef / ready, each with a reason; copy fallback | src/modules/organiser/p3/screens/ShareLinkCard.tsx:9-85; src/modules/organiser/p3/data/shareState.ts:12-27 | O1 (Share: copy) |
| W40 | Share link = PUBLIC EVENT URL `?ref=<code>` (not the organiser page) | src/modules/organiser/p3/data/analyticsV2.ts:159-165 | O1 (Share my page needs a page link, GAP-2) |
| W41 | Client click types `ticket, instagram, whatsapp, share, organiser_external, other` | src/lib/eventLinkClicks.ts:25-31 | O2 |
| W42 | Directions click = type `other`, source `...:directions` | src/modules/event-page/bento/EventStickyActionBar.tsx:170-177 | O2 |
| W43 | Share click sources `:web_share`, `:clipboard`; WhatsApp `:share_fallback` | src/modules/event-page/bento/utils/eventActions.ts:45,56,64 | O2 |
| W44 | Group chat click = `whatsapp` | src/modules/event-page/bento/blocks/GroupChatBlock.tsx:67-69 | O2 |
| W45 | Profile progress (my_profile_progress_v1): `percent, requiredLeft, publishReady, steps{area,field,required,done}, declined` | src/modules/organiser/shared/profileProgress.ts:12-20,49-53 | O4 |
| W46 | "N answers left" wording; go-live lock "Finish your profiles first, N answers left" | src/modules/organiser/shared/profileProgress.ts:61,65-68 | O4 (next step) |
| W47 | Organiser completeness fields: name, city, logo (avatar_url), organisation_category, founded_year, instagram, contact_phone, bio, website, facebook (+ contact_email / address) | src/modules/organiser/wizard/registry.tsx:3,146-161 | O4 |
| W48 | Wizard "Your profile is N% complete", ProgressBar / LevelTrack ring | src/modules/organiser/wizard/ProfileWizard.tsx:220-221,252; src/modules/organiser/wizard/LevelTrack.tsx:9 | O4 |
| W49 | My page "Required to publish: N answers left" | src/modules/organiser/page/index.tsx:48 | O4 |
| W50 | You rows: Switch (2+ pages), Page (required left), Team (count, request badge), Add a page | src/modules/organiser/p3/you/youRows.ts:58-67 | Vis / O1 |
| W51 | Team roles `owner / manager / contributor`; add as manager or contributor | src/modules/organiser/shared/teamModel.ts:20,196 | Vis |
| W52 | P3 tabs Home / Events / Stats / You | src/modules/organiser/p3/model/labels.ts:17 | EXCLUDED: navigation shell, options may redraw it |
| W53 | Level rating per series (series_level_summary_p5_v1): `vote_count, threshold, counts, derived_level, my_level`; levels `mostly_beginners / mixed / strong` | src/hooks/useSeriesLevelRating.ts:7-22,28 | O4 (Level rating) |
| W54 | Dates filter `coming / past / cancelled / breaks / own` | src/modules/organiser/p3/data/dates.ts:43,75 | O2 (cancelled night) |
| W55 | R1 date `lifecycle_status === 'cancelled'`; attention kinds `cancelled / tonight` | src/modules/organiser/shared/homeModel.ts:74-79 | O2 |
| W56 | P3 home_v1 lists only scheduled dates: no "Cancelled tonight" | src/modules/organiser/p3/model/status.ts:23 | GAP-3 |
| W57 | Organiser overall Rating (not level): no field, RPC or screen in src | (grep `rating` src/modules/organiser, src/modules/profile: none) | GAP-1 |
| W58 | City average of ratings / organisers-per-city count: none in src | (grep `average` src/modules/organiser, src/modules/profile: none) | GAP-1 |

## 2. Public organiser page (`/organisers/:id`)

| # | Item | Cited at | Contract map |
|---|---|---|---|
| P1 | Route `organisers/:id` -> app/routes/organiser.tsx -> OrganiserProfile | app/routes.ts:13; app/routes/organiser.tsx:240 | O1 (the "my page" a Share action points at) |
| P2 | Public columns `id, name, avatar_url, bio, socials, city_id, instagram, website, organisation_category, founded_year` (never claimed_by / contact_*) | src/lib/organiserPublicCols.ts:11-22,48-49 | O4 (completeness mirrors these) |
| P3 | Hero: avatar, meta line, name, FullProfileMark, ManagedBadge | src/pages/OrganiserProfile.tsx:1050-1067 | O4 |
| P4 | Full profile = organiser_full_profile_v1 true at 100% | src/modules/profile/organiserPublicProfile.ts:175-186; src/pages/OrganiserProfile.tsx:568-574 | O4 |
| P5 | Bio shown once, 150 chars + More | src/pages/OrganiserProfile.tsx:986-1000 | O4 |
| P6 | Stats strip Next night / Nights hosted (min 5) / Running since (founded_year >= 1950); never 0 | src/modules/profile/organiserStats.ts:29-38; src/modules/profile/OrganiserStatsStrip.tsx:18-45 | EXCLUDED: public-page decoration; dashboard shows per-night cards (O2) |
| P7 | Get in touch rows `whatsapp / instagram / website / email`, each with Copy | src/modules/profile/OrganiserGetInTouch.tsx:15,47-66,113 | O4 (contact step) |
| P8 | Link labels: @handle / Facebook page / bare domain | src/lib/organiserLinkLabels.ts:20-68 | O4 |
| P9 | Team list: one "Team", no public role labels; modes solo / list / empty; owner empty link to Team | src/modules/profile/organiserTeam.ts:5,61; src/pages/OrganiserProfile.tsx:1139-1148 | Vis / O1 (no team) |
| P10 | Team person click emits profile view `organiser:team` | src/modules/profile/OrganiserTeamSection.tsx:96 | EXCLUDED: views of team members, not of the page |
| P11 | "Is this you?" claim card while unclaimed | src/pages/OrganiserProfile.tsx:1151-1173 | O1 (no team) |
| P12 | Empty kinds `owner-blank / none / past-only`; owner "Just getting started" + Add a bio | src/modules/profile/organiserEmptyState.ts:21,34; src/pages/OrganiserProfile.tsx:1177-1194 | O1 / O4 |
| P13 | Next nights cards, cap 20, countdown chip Tonight / Tomorrow / in N days | src/pages/OrganiserProfile.tsx:1209-1250; src/modules/profile/nightsCardModel.ts:26-31,65-68 | O2 |
| P14 | Past nights / "Recently hosted" strip, "N nights hosted" | src/pages/OrganiserProfile.tsx:1280-1293; src/modules/profile/PastHighlights.tsx:43 | EXCLUDED: history; contract is upcoming nights |
| P15 | Cancelled nights dropped (client `continue`, and server-side) | src/pages/OrganiserProfile.tsx:693,706 | GAP-3 |
| P16 | Owner edit-in-place layer (pencils per item) | src/pages/OrganiserProfile.tsx:520,1371 | O4 (target of the next step) |
| P17 | Organiser page opens: `profile_view_events` (person_id, profile_type, source_context, viewed_at, viewer_session_id) | src/integrations/supabase/types.ts:7679-7689 | O2 (page opens line) |
| P18 | Organiser views are written only on clicks to the organiser from event pages, never on page load | src/modules/event-page/bento/blocks/OrganiserCardBlock.tsx:272,331; src/components/organiser/OrganiserHoloCard.tsx:53 | GAP-5 |

## 3. Admin app (via Website docs)

| # | Item | Cited at | Contract map |
|---|---|---|---|
| A1 | organiser_analytics_v2 `link_taps` zones `ticket, directions, share, group_chat, instagram, organiser_link, other` | docs/briefs/organiser-stats-v2-share-card.INVENTORY.md:21 | O2 |
| A2 | totals `visitors / views / from_your_link` | docs/briefs/organiser-stats-v2-share-card.INVENTORY.md:18-20 | EXCLUDED: page views / source split |
| A3 | totals `tickets_sold` (non-zero only) | docs/briefs/organiser-stats-v2-share-card.INVENTORY.md:24 | O3 |
| A4 | totals `guest_list_signups`, `window_capped` | docs/briefs/organiser-stats-v2-share-card.INVENTORY.md:23,26 | EXCLUDED: not in contract |
| A5 | Refusals 42501 not_signed_in / not_allowed, 22023 bad_request | docs/briefs/organiser-stats-v2-share-card.INVENTORY.md:27-28 | Vis |
| A6 | organiser_share_code_v1 `share_code` (may be null), `disabled` | docs/briefs/organiser-stats-v2-share-card.INVENTORY.md:29-32 | O1 |
| A7 | Admin screens for the same data | docs/briefs/organiser-stats-v2-share-card.INVENTORY.md:36 | GAP-7 |
| A8 | get_organiser_nights_v2 filters `not is_cancelled` server-side; proposed additive `p_include_cancelled` | docs/briefs/organiser-cancelled-nights.handover.md:6-25 | GAP-3 |
| A9 | E7 owner decision pending: show cancelled nights, never count them (23 organisers have one) | docs/arcs/organiser.md:44,50 | O2 (cancelled night) |
| A10 | Nights feed v2: all cities, next 20, no cancelled (A#1266) | docs/arcs/organiser.md:16 | O2 |
| A11 | Organiser analytics S1/S2 parked "until the organiser dashboard exists" | docs/arcs/organiser.md:46 | GAP-7 |
| A12 | Interim seats I1 / admin Seats panel I3 | docs/arcs/organiser.md:26,37 | Vis |
| A13 | ticket_sales_summary_v1 (live Website caller; owner pence, manager count) | docs/briefs/design-ticketing-organisers.md:81; src/modules/organiser/tickets/ticketsApi.ts:14,65 | O3 |
| A14 | ticket_types_manage_v1 / price steps (planned) | docs/briefs/design-ticketing-organisers.md:80,122 | EXCLUDED: ticket editor, not dashboard |
| A15 | organiser_series_stats_v1 (admin ER P4 A4), team-wide, no page argument | src/modules/organiser/p3/data/stats.ts:5-9,117-121 | EXCLUDED: views tile source (only used for O2 opens, W20) |
| A16 | B0 hygiene: get_organiser_venue_options_v1 needs `city_id`; refusal copy (city_follows_venue ...) | docs/briefs/wb-b0-organiser-hygiene-handover.md:26,55,65-74 | EXCLUDED: event editor |

## 4. Existing prototypes (branch brief/profile-dash-organiser-designs)

| # | Item | Cited at | Contract map |
|---|---|---|---|
| X1 | Header: name, Public page, "Live on Bachata Calendar" | org-proto-dashboard.md:110-115 | O1 / O4 |
| X2 | "Profile: 4 of 5 details done" + "Add contact details" | org-proto-dashboard.md:117-118 | O4 |
| X3 | Needs you: join requests, event in review, date taken off | org-proto-dashboard.md:123-127 | O1 |
| X4 | Page views 30 days, "vs previous 30 days" | org-proto-dashboard.md:134,267 | EXCLUDED: page-view tile |
| X5 | Link clicks tile "tickets, maps, socials" | org-proto-dashboard.md:135 | O2 (moves onto the per-night card) |
| X6 | Going tile "people marked attending" | org-proto-dashboard.md:136 | O2 |
| X7 | Level rating "0.0 from 00 ratings" (+ sparkline) | org-proto-dashboard.md:137,197 | O4 (real shape is a 3-level vote, W53, not a 0-5 score) |
| X8 | Next dates list with Change | org-proto-dashboard.md:142-146 | O2 |
| X9 | Your events Live / In review / Draft + New event | org-proto-dashboard.md:151-155 | O2 |
| X10 | Team avatars, "1 owner, 1 manager, 1 contributor", Invite | org-proto-dashboard.md:160-164 | Vis |
| X11 | Bottom tabs Home / Events / Team / Profile | org-proto-dashboard.md:170-173 | EXCLUDED: navigation |
| X12 | One event: Dates / Performance / Details, "% vs previous" | org-proto-dashboard.md:189-197 | EXCLUDED: comparisons / page views |
| X13 | Where clicks go Tickets / Map / Instagram / WhatsApp | org-proto-dashboard.md:202-207 | O2 |
| X14 | Upcoming dates with N going; "Taken off" + Put back | org-proto-dashboard.md:212-216 | O2 (cancelled night) |
| X15 | Event details checklist Flyer / Venue / Lineup / Links | org-proto-dashboard.md:221-226 | EXCLUDED: event editor |
| X16 | Desktop: sidebar, Switch organiser, Next dates table (Going, Status) | org-proto-dashboard.md:243-283 | Vis |
| X17 | Needs you across organisers incl. "New low rating", "Door list ready" | org-proto-area.md:117-122 | O1 |
| X18 | Today card: tonight, going, checked in, Check-in / Share / Change | org-proto-area.md:125-128 | O2 |
| X19 | Last 30 days incl. "Rating 0.0 +0.0" | org-proto-area.md:131-136 | O4 (Rating; deltas EXCLUDED) |
| X20 | First steps 3 of 6 (dancer profile, photo, two lines, first event, invite, share card) | org-proto-area.md:138,387-397 | O1 / O4 |
| X21 | Switch organiser list with roles Owner / Manager / Door staff | org-proto-area.md:154-161 | Vis |
| X22 | Events filter All / Live / Draft / Ended | org-proto-area.md:168-173 | O2 |
| X23 | One event stats 7 / 30 / 90 / Custom; views and going by day chart | org-proto-area.md:208-218 | EXCLUDED: chart |
| X24 | Where visitors come from Search / Instagram / WhatsApp / Direct | org-proto-area.md:228-232 | EXCLUDED: source split |
| X25 | Insights: compare events, month by month, best / quietest weekday | org-proto-area.md:237-255 | EXCLUDED: chart / summary |
| X26 | Guests and check-in, scan | org-proto-area.md:267-295 | EXCLUDED: door tool |
| X27 | Share card: Story / Square post / Poster + QR, Copy link, Save image, PDF | org-proto-area.md:299-309 | O1 (Share; Instagram) |
| X28 | Roles matrix incl. Door staff | org-proto-area.md:313-329 | Vis (Door staff is not a code role, GAP-6) |
| X29 | Join requests (accept as role), invite link | org-proto-area.md:342-357 | Vis |
| X30 | Public page tap to edit: cover, name, about, city, links, contact | org-proto-area.md:361-383 | O4 |
| X31 | More: show phone / email, show who is going, hand over, leave | org-proto-area.md:402-419 | EXCLUDED: settings |
| X32 | Public page "Poster": category line, Upcoming / Past nights / Team counts | org-proto-profile.md:96-100 | EXCLUDED: public page redesign |
| X33 | "No new dates yet" + Get the next date / Join WhatsApp | org-proto-profile.md:102-108,127-130 | O1 (zero = what to do) |
| X34 | Contact WhatsApp / Instagram / Website; Team with role tag | org-proto-profile.md:112-115 | O4 / Vis |
| X35 | Public page "Full-bleed" variant | org-proto-profile.md:121-138 | EXCLUDED: public page redesign |

---

## GAPs

- **GAP-1 Rating and city average (O4).** Only the per-series LEVEL vote exists (W53). No overall
  organiser Rating field, no RPC, no city average, no count of organisers per city to gate the 5+
  rule. The prototypes' "Rating 0.0" (X19) and "0.0 from 00 ratings" (X7) have no source.
- **GAP-2 Share my page (O1).** The only share is Copy link to the next live EVENT with `?ref=`
  (W39-W40). No organiser-page link, no WhatsApp share, no Instagram caption, no share card (X27 is
  prototype only). With no live event the card is disabled ("Put an event live to get a link").
- **GAP-3 Cancelled night (O2).** get_organiser_nights_v2 drops cancelled server-side (A8, P15) and
  organiser_home_v1 lists only scheduled dates (W56). Cancelled data exists only in the Going read
  (`is_cancelled`, W22-W23) and the dates workspace (W54). E7 owner decision pending (A9).
- **GAP-4 Per-night opens and clicks (O2).** Views are per series per day (W20); link taps are series
  totals over a window (W37, A1). No per-occurrence opens or per-type clicks read exists. Click type
  names differ: client sends `whatsapp` and `other`+`:directions` (W41-W44), server zones are
  `group_chat` and `directions` (A1); the mapping is in admin SQL, not readable here.
- **GAP-5 Page opens line.** No organiser read of `profile_view_events`, and the public organiser
  page does not emit a view on load (P18): today the table only holds clicks to an organiser from
  event pages.
- **GAP-6 Whole-team visibility.** Analytics are owner / manager of the series only (W38, A5),
  Going is hidden from contributors (W25), ticket money is owner only (W26). The contract says whole
  team; this needs admin RPC changes. "Door staff" (X21, X28) is not a role in code (W51).
- **GAP-7 Admin source not readable in this session.** Admin screens for organiser data (A7), the
  parked analytics S1/S2 (A11), and every RPC body cited via docs are unverified here.

## Coverage

Total items: 58 (W) + 18 (P) + 16 (A) + 35 (X) = 127.
Covered (mapped to O1-O4 / Vis, will appear in all 3 options): 90.
Not covered, justified: 29 EXCLUDED (contract exclusions: page views, chart, source split, summary;
or out of dashboard scope: legacy hub, routing, navigation, editors, settings, door tool, public-page
history and redesigns) + 8 GAP-only (W56, W57, W58, P15, P18, A7, A8, A11).
Items mapped to O1-O4 whose data is short (W20, W25, W37, W38, W40, P17, X7, X19, X28) count as
covered: they appear in all 3 options, with the matching GAP stated on the card.

**Coverage: 90 covered / 127 total**
