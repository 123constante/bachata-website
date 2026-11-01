# P2-B Professional benchmark: organiser dashboards vs ours

Ticket dt_90d5fcb29521. Docs only. Written 2026-10-23.
"main" = `origin/main`. "c8" = `origin/claude/er-c8-eventpage` (94a7e5ea). "proto" = prototype v7 on `origin/arc/briefs-organiser-r1:docs/organiser-rebuild/er/organiser-prototype.html`. Paths are under `src/modules/organiser/` unless stated.

## 1. Owner summary

What the professionals do that we must match to launch:
1. **One clear home, then one event page.** Luma, Eventbrite and Meetup all start from "your events", then one page per event with everything on it. Ours has this on c8 (`events/EventPage.tsx`); main still has the older Details/Programme/Organisers screens.
2. **Recurring events have a "this date / all dates" choice.** Meetup asks "this event, this and following, or all". Eventbrite lets you edit or remove one date. We have this (change/cancel flows).
3. **Co-hosts with real access.** Luma lets you add a host and choose whether they appear on the page and/or can manage it. Meetup has tiered roles. Ours: all equal, invite from the event (`organisers/OrganisersScreen.tsx:123` on c8). Good, and simpler.
4. **Simple traffic numbers.** Luma shows page views for the past month, week or day. We have NOTHING for organisers yet. This is the biggest launch gap: you promised views and saves at launch.
5. **Courses.** Skiddle's Event Series and Meetup treat repeating blocks as normal. Ours is switched off ("Not available yet", `shared/event-rules.json:12` on c8). Launch needs it on.
6. **A way to check what the public sees.** Pros offer "view event page". We only have a "See it live" link (main `events/OneEvent.tsx:153`). No true preview.
7. **Duplicate an event.** Luma has Clone. We can copy one date's details to another date, but not duplicate a whole event.

Three things we can do better for low-tech phone organisers:
1. **Take over, don't sign up.** Pros make you build a listing from zero. Your organisers arrive to an event that already exists and is matched to them. No pro does this.
2. **Plain words, one question per screen.** Pro dashboards are built for desktop and ticket sales (tiers, refunds, check-in). We can hide all of that and speak in dance-night words ("Take this date off").
3. **Line-up from real profiles.** Pros type artist names as text. We pick real teacher/DJ profiles, so the public page links through and nothing is misspelt.

## 2. Capability matrix

Tag key: MUST = MUST-HAVE-FOR-LAUNCH, LATER, NOT-US. Ours: have / partial / missing. "Seen" says which code I read.

| # | Capability | What the pros do | Ours | Seen | Tag |
|---|---|---|---|---|---|
| 1 | Home / information architecture | Luma: events list with a manage page per event. Airbnb host app: a "Today" first screen, then Calendar, Listings, Menu ([Airbnb](https://www.airbnb.com/resources/hosting-homes/a/new-hosting-tools-to-help-grow-your-business-738)). Meetup: group-level tools. | partial. Routes `events`, `team`, `page`, `more` (`shell/OrganiserRoutes.tsx:125-155` main; `:141-157` c8) but main and c8 both still carry the old `change/*`, `add/*`, `cancel/*`, `new/*` flows beside the event page: two navigation models. | main + c8 | MUST |
| 2 | Onboarding / first event (take over) | Luma, Eventbrite, Skiddle: create from scratch ([Skiddle](https://help.promotioncentre.co.uk/en/articles/9362865-how-to-add-an-event)). Nobody auto-matches. | partial. Welcome + onboarding exist (`switch/Welcome.tsx`, `home/onboarding/*` c8). The invite-journey arc owns this; connect, do not re-plan. | c8 | MUST |
| 3 | Lifecycle: draft, live, pause, cancel, end | Eventbrite: status "Postponed" turns off sales ([Eventbrite](https://www.eventbrite.com/help/en-us/articles/256014/create-multiple-date-or-recurring-events/)). Meetup: cancel is final and cannot be undone ([Kajabi on Meetup](https://help.kajabi.com/en/articles/17174426)). | have. Pause, stop, end, delete overlays (`events/EventPage.tsx:83`, paused line `:283` c8; `events/OneEvent.tsx:116` main). "End" for courses reads "Not available yet" (`events/eventPageModel.ts:350`). | main + c8 | MUST |
| 4 | Duplicate an event | Luma: More > Clone Event, copies everything but guests ([Glitter guide](https://www.glitter.io/guides/how-to-duplicate-your-luma-event-step-by-step-guide)). Eventbrite: "Copy your event". | partial. Copy one date to another (`flows/change/Copy.tsx`). No whole-event duplicate. | main + c8 | LATER (organisers mostly repeat via weekly series) |
| 5 | Recurring dates + one-off exceptions | Eventbrite: edit or delete one time slot under "Manage dates and times". Meetup: this / this-and-following / all. Skiddle Event Series: a year of listings in minutes ([Lancashire Business View](https://lancashirebusinessview.co.uk/latest-news-and-features/skiddle-unveils-powerful-event-series-feature-7436)). | have. Per-date edit, take-off, add date (`dates/DateSheet.tsx`, `flows/cancel/*`, `flows/add/*`). Gap: no "this and following" choice found. W6 (year missing on far dates) is a polish bug. | main + c8 | MUST |
| 6 | Courses (multi-week blocks) | Skiddle series, Meetup repeating events. | partial. Existing courses are editable; creating is blocked: creatable formats only `recurring`/`one_off` (`events/eventType.ts:9-12` main); `formatOff.course` (`shared/event-rules.json:12` c8). Proto has "N weeks from DATE" copy. | main + c8 + proto | MUST (owner: switch ON) |
| 7 | Sessions / line-up from real profiles | Luma and Skiddle: free-text lineup/description. | have, and better than pros. People picker on a date (`dates/peoplePicker.ts`, `dates/DateSheet.tsx`); c8 adds `sessions/SessionSheet.tsx`. | main + c8 | MUST |
| 8 | Venue picking | Eventbrite/Skiddle: search or type address. | have. `venue/VenuePicker.tsx` with look-alike check (`:122`) and add-venue (`venue/addVenue.ts`) on c8; `flows/change/Venue.tsx` on main. | main + c8 | MUST |
| 9 | Co-host / team, equal roles, invites | Luma: Add Host; choose shown on page and/or can manage; emailed invite ([Luma](https://help.luma.com/p/adding-hosts-and-managers-to-your-event)). Meetup: Organizer, Co-organizer, Assistant, Event organizer ([Meetup help](https://help.meetup.com/hc/en-us/articles/360002879411)). Facebook: add from the Edit screen (third-party sources, unverified). | have on c8: `organisers/OrganisersScreen.tsx:123`, `InvitationsList.tsx`, RPC `series_invite_organiser_v1`. Main: team sheet with invite link (`edit-in-place/TeamSheet.tsx:7`), no per-event invite screen. | main + c8 | MUST |
| 10 | Photos / covers | Luma: cover image on create. Airbnb: photo-led listing (not verified in detail). | have. Flyer/cover upload (`shared/flyerUploadApi.ts`, `flows/fix/CoverFlow.tsx`, `events/media.ts`). | main + c8 | MUST |
| 11 | How-to-pay line (no ticketing) | Pros sell tickets; none has a pay-line-only mode. | have. Pay rows, codes door / bank transfer / ticket link (`shared/event-rules.json` payment; `events/EventPage.tsx:364` c8). W3: two rows both called "Ticket link" (main `events/EditorSheet.tsx:19,291`). | main + c8 | MUST |
| 12 | Organiser stats (views, saves) | Luma Insights: page views past month/week/day, referrers, cities, UTM links ([Luma](https://help.luma.com/p/event-insights)). RA Pro: live sales and audience ([RA](https://pro.ra.co/)). Dice: analytics to promoters (press only). | **missing.** No stats screen or call in `src/modules/organiser/**` on either ref. A views table exists (`event_views`, `src/integrations/supabase/types.ts:3499`); saves source not checked. | main + c8 | MUST (owner) |
| 13 | History / audit | Shopify has activity timelines and third-party undo history ([apps](https://apps.shopify.com/bulkeditly)); native detail not verified. | missing for organisers ("not found"). Admin side logs team changes (`edit-in-place/teamPickerModel.ts:86`). | main + c8 | LATER (but server must keep who/when) |
| 14 | Attendee notifications | Eventbrite: tells you to email attendees yourself on change. Meetup: no auto cancel notice found. | missing ("not found"). | main + c8 | LATER (leave room) |
| 15 | Mobile-first editing | Eventbrite has an Organizer app; Luma is a responsive web page. | partial. Bottom sheets, 390px design. Bugs W4 (30px title button), W7 (misaligned buttons). | main + c8 | MUST |
| 16 | Bulk edits | Shopify: spreadsheet-style bulk edit. Meetup: "all events". | partial. "All dates" bulk change (`flows/change/bulkApi.ts`). | main + c8 | LATER |
| 17 | Undo | Shopify: none native (third-party apps add it). Meetup: cancel cannot be undone. | partial. Take-date-off has an undo line (`dates/DateSheet.tsx:133` main, `:154` c8) and person undo (`:261`/`:282`). No general undo. Owner wants "save, undo, conflict" as ONE model. | main + c8 | MUST (for cancel/take-off) |
| 18 | Preview of the public page | Luma: view event page from manage. Airbnb: view listing as a guest (not verified). | partial. `ui/PreviewBar.tsx` is a SAVE bar (`dates/index.tsx:322`), `dates/DatePreview.tsx` previews one date's lines. "See it live" link only. No full preview. | main + c8 | MUST (fear: wrong info shown publicly) |
| 19 | Help and empty states | Stripe: explain why empty, offer one next action, button text matches title ([Stripe](https://docs.stripe.com/stripe-apps/patterns/empty-state)). | partial. Help rows (`more/help/helpRows.ts`), `flows/NoEventsYet.tsx`, `ui/States.tsx`. Walk shows some states without a next step. | main + c8 | MUST |
| 20 | Error messages | Pros mostly generic. | partial. W5: server refusal shown as "Check your connection". Error maps exist (`shared/selfServeErrors.ts`, `team/teamErrors.ts`) but are not one set. No Sentry call in the module. | main + c8 | MUST |
| 21 | Promoted / featured listings | Skiddle: featured events claimed ~5x views, requested via promoter support ([Skiddle blog](https://blog.promotioncentre.co.uk/how-do-you-feature-your-event-on-skiddle/), vendor claim). RA: "free promotion tools" plus ticketing. | missing ("not found"). | n/a | LATER (leave a slot on the event page and a field on the series) |
| 22 | Multi-city | Eventbrite/Meetup: location-based. | partial. City search at onboarding (`home/onboarding/citySearch.ts`), `shared/createCity.ts`. Nothing London-hardcoded was grepped for; a full sweep is not done. | main + c8 | MUST (no hardcoding) |
| 23 | Rollout off-switch | n/a | have on c8. `VITE_ORGANISER_REBUILD` (`shell/OrganiserRoutes.tsx:96`, `shell/rebuildSwitch.ts`). Main has no switch. | c8 | MUST |
| 24 | Ticket selling, refunds, check-in, tiers | Eventbrite, RA, Dice, Skiddle, Fatsoma. | not applicable. | n/a | LATER / NOT-US (tickets later; check-in and tiers NOT-US) |
| 25 | Role tiers (viewer / check-in only) | Luma: Manager, Non-manager, Check-in only (Plus). Meetup tiers. | not applicable; owner says all equal. | n/a | NOT-US |

Prototype v7: mentions invites, courses ("N weeks from"), preview helpers and undo toasts; it has no stats, history or featured slot. (Grep of the HTML only.)

## 3. Patterns worth copying

1. **Empty state = reason + one button whose label matches the title.** [Stripe empty-state guide](https://docs.stripe.com/stripe-apps/patterns/empty-state). Organisers who see a blank screen assume it is broken.
2. **Recurring choice in three plain words: this date / this and following / all.** [Meetup via Kajabi](https://help.kajabi.com/en/articles/17174426). Matches how organisers think; "this and following" is the one we lack.
3. **Co-host chooses "show on page" and "can manage" as two separate switches** (we would keep one: both). [Luma](https://help.luma.com/p/adding-hosts-and-managers-to-your-event). The idea worth copying: a host may be a name on the page without logging in.
4. **Stats as ONE line, three time ranges (day, week, month).** [Luma Insights](https://help.luma.com/p/event-insights). No charts needed for launch.
5. **Postponed as its own state, not delete.** [Eventbrite](https://www.eventbrite.com/help/en-us/articles/256014/create-multiple-date-or-recurring-events/). Fits our Pause.
6. **A "Today" first screen answering "what is happening next?"** [Airbnb host tools](https://www.airbnb.com/resources/hosting-homes/a/new-hosting-tools-to-help-grow-your-business-738). Matches "one thing per screen". Sources here are thin; a screenshot walk of the app is still needed.
7. **Year of dates in minutes.** [Skiddle Event Series](https://lancashirebusinessview.co.uk/latest-news-and-features/skiddle-unveils-powerful-event-series-feature-7436). We already do weekly; do the same for courses.
8. **Featured-listing request as a simple form later.** [Skiddle](https://blog.promotioncentre.co.uk/how-do-you-feature-your-event-on-skiddle/): they started with an email to support, no new screens. We can too.

## 4. Anti-patterns to avoid

- **Ticketing language everywhere** (tiers, on-sale/off-sale, refunds). Skiddle's flow has a "skip tickets" step; Eventbrite makes you refund before removing a date. Confuses non-ticketing organisers. Hide it.
- **Irreversible cancel with no undo** (Meetup). Our fear is wrong info; give an undo window instead.
- **Three visibility modes** (public, private, passworded; Skiddle). Our instant-publish model should have none of this.
- **Convert-recurring-to-single needs deleting everything first** (Eventbrite). We already block "One date" on a live repeating event with a reason; keep the reason text.
- **Roles that need explaining** (Luma Check-in only, Meetup four tiers). Owner chose equal roles.
- **Hidden features behind a "More" menu** (Luma Clone). Fine for duplicate; wrong for stats.
- **Generic "check your connection" for server refusals.** Our own W5.
- **Two rows with the same label.** Our own W3.
- **Old and new screens mixed** (W1: Back lands on old `/details`). Our own.

## 5. Sources

- Luma: [Adding hosts and managers](https://help.luma.com/p/adding-hosts-and-managers-to-your-event); [Event Insights](https://help.luma.com/p/event-insights); [Clone guide (third party)](https://www.glitter.io/guides/how-to-duplicate-your-luma-event-step-by-step-guide)
- Eventbrite: [Recurring events](https://www.eventbrite.com/help/en-us/articles/256014/create-multiple-date-or-recurring-events/)
- Meetup: [Help centre](https://help.meetup.com/hc/en-us/articles/360002879411); [Canceling a repeating event](https://help.meetup.com/hc/en-us/articles/39923354771725-Canceling-a-repeating-event); [via Kajabi](https://help.kajabi.com/en/articles/17174426)
- Resident Advisor: [RA Pro](https://pro.ra.co/); [RA Tickets](https://pro.ra.co/ra-tickets)
- Skiddle: [How to add an event](https://help.promotioncentre.co.uk/en/articles/9362865-how-to-add-an-event); [Event Series](https://lancashirebusinessview.co.uk/latest-news-and-features/skiddle-unveils-powerful-event-series-feature-7436); [Featuring](https://blog.promotioncentre.co.uk/how-do-you-feature-your-event-on-skiddle/)
- Dice: [TechCrunch](https://techcrunch.com/2021/09/26/londons-dice-raises-122m-at-a-400m-valuation-for-its-intelligent-event-discovery-and-booking-platform) (press only)
- Stripe: [Empty states](https://docs.stripe.com/stripe-apps/patterns/empty-state)
- Shopify: [BulkEditly (third-party app)](https://apps.shopify.com/bulkeditly)
- Airbnb: [Hosting tools](https://www.airbnb.com/resources/hosting-homes/a/new-hosting-tools-to-help-grow-your-business-738)
- Ours: code and docs refs named per row (git only, no admin repo read).

## Verified / Not verified

**Verified:** the code facts and file:line references above, read from `origin/main` and `origin/claude/er-c8-eventpage` via grep/`git show`. Luma, Eventbrite recurring, Meetup roles, Stripe empty states, Skiddle listing and featuring, RA Pro feature list: from public search-result summaries.

**Not verified:**
- Dice promoter tools, Facebook Events (host rules, recurring, insights), Fatsoma: no official help found; nothing from them is relied on.
- Airbnb: only the Today/Calendar/Menu layout; photo-led feel, preview-as-guest and co-host permissions for homes not confirmed.
- Shopify and Stripe admin patterns (bulk edit, undo, history) beyond Stripe's empty-state guide and third-party app claims.
- Meetup's cancel options come via a third-party (Kajabi) summary; the Meetup page itself was not opened.
- No page was opened in full (search summaries only); no app-store screenshots or reviews reviewed.
- Our app was NOT run or walked; the matrix is from code and grep, so "have" means code exists, not that it works. Missing "not found" rows could hide code under other names.
- Saves data source for stats not checked; admin repo (AD1-AD4) and prod Supabase not read; invite-journey branches not read.
- Prototype v7 checked by grep only.
