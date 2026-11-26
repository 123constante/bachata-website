// Feature flags for the listing-request gate (Phase 5 of listing-requests
// + smart-dashboard plan). Each flag controls one of the five public-page
// surfaces that aren't ready to ship yet — when false, the route renders
// <ComingSoonGate> + <ListingRequestForm> instead of the real page.
//
// Boolean strings come from Vite's import.meta.env at build time. Vercel
// production env vars override the .env.production fallback. Development
// (npm run dev) reads .env.development which sets all flags true so local
// work isn't blocked.

export const flags = {
  teachersDirectory:   import.meta.env.VITE_ENABLE_TEACHERS_DIRECTORY === 'true',
  teacherDetail:       import.meta.env.VITE_ENABLE_TEACHER_DETAIL === 'true',
  organisersDirectory: import.meta.env.VITE_ENABLE_ORGANISERS_DIRECTORY === 'true',
  organiserDetail:     import.meta.env.VITE_ENABLE_ORGANISER_DETAIL === 'true',
  venueDetail:         import.meta.env.VITE_ENABLE_VENUE_DETAIL === 'true',
  // Standalone /raffles landing page. NOT a listing-request gate — when false
  // the route redirects home (see AnimatedRoutes), it does not render
  // ComingSoonGate. Default true in dev, false in prod until the public
  // list_open_raffles_v1 RPC is live.
  rafflesPage:         import.meta.env.VITE_ENABLE_RAFFLES_PAGE === 'true',
  // Raffle v2 (win a free night; raffle_public_board_v1 board on event pages and /raffles).
  // Arc: raffle-r3a/r3b. Default OFF; nothing reads it yet (R3a is foundations only).
  raffleV2:            import.meta.env.VITE_ENABLE_RAFFLE_V2 === 'true',
  // /raffles redesign part A (look C v6: hero, orbs, steps, footer, sticky bar). Only read when raffleV2 is on.
  // OFF = today's board page, unchanged. Turn on with VITE_ENABLE_RAFFLE_REDESIGN=true.
  raffleRedesign:      import.meta.env.VITE_ENABLE_RAFFLE_REDESIGN === 'true',
  // Event-page raffle tile opens the same black + orange /raffles entry sheet, with plainer copy and an in-sheet
  // "closed" note. Only read when raffleV2 is on. OFF = today's tile and dialog. VITE_ENABLE_RAFFLE_TILE_SHEET=true.
  raffleTileSheet:     import.meta.env.VITE_ENABLE_RAFFLE_TILE_SHEET === 'true',
  // Door page "Already admitted": friendly London time ("Used today at 20:00") instead of the raw value.
  // OFF = today's door screen, unchanged. Turn on with VITE_ENABLE_RAFFLE_DOOR_TIME=true.
  raffleDoorTime:      import.meta.env.VITE_ENABLE_RAFFLE_DOOR_TIME === 'true',
  // Raffle winner photo: face-guide + in-browser background removal. OFF = today's photo step.
  raffleCutout:        import.meta.env.VITE_ENABLE_RAFFLE_PHOTO_CUTOUT === 'true',
  // /raffle/win/:token polish (shorter gate, door-photo wording, flyers, contact buttons). OFF = today's screens.
  raffleWinPolish:     import.meta.env.VITE_ENABLE_RAFFLE_WIN_POLISH === 'true',
  // Dancer home raffle-win card: Golden Ticket layout. OFF = today's card, unchanged.
  raffleGoldenTicket:  import.meta.env.VITE_ENABLE_RAFFLE_GOLDEN_TICKET === 'true',
  // Dancer home drawn in prototype A's look (Golden Ticket + rest of home). OFF = today's screen, unchanged.
  homeGoldenLook:      import.meta.env.VITE_ENABLE_HOME_GOLDEN_LOOK === 'true',
  // Raffle entry: one-line "Winners get a WhatsApp from Ricky" heads-up. OFF = today's screens, unchanged.
  raffleWinnerHeadsup: import.meta.env.VITE_ENABLE_RAFFLE_WINNER_HEADSUP === 'true',
  // Federated search v5 (Cmd+K / mobile full-screen overlay + search_public_v5).
  // When false the existing HeaderSearch omnibox (search_public_v4) renders
  // unchanged, so prod is untouched until this flips per-environment.
  searchV5:            import.meta.env.VITE_ENABLE_SEARCH_V5 === 'true',
  // search_public_v6 = v5 + dancer-rated series level (derived_level,
  // level_vote_count per event, unrated_event_count, p_level filter) and the
  // level chips on /search. OFF: every search path stays on v5/v4 unchanged.
  searchV6:            import.meta.env.VITE_ENABLE_SEARCH_V6 === 'true',
  // search_public_v7 = v6 with ONE row per person (`people`, roles as a line)
  // instead of separate teachers / djs / dancers arrays. OFF until /people/:id
  // ships (a result row links there); OFF = every search path is unchanged.
  searchV7:            import.meta.env.VITE_ENABLE_SEARCH_V7 === 'true',
  // The face wall on /djs and /dancers (src/modules/person-page/wall): 4-column big faces, role
  // chips, filter chips, warm dark base. OFF = both pages exactly as before. Turn on with
  // VITE_ENABLE_PEOPLE_WALL=true (Vercel env) -- no code change.
  peopleWall:          import.meta.env.VITE_ENABLE_PEOPLE_WALL === 'true',
  // The person hub on /people/:id (src/modules/person-page/hub): face, name, facts, then one big
  // card per role page; wall tiles open it. OFF = the tabbed /people/:id page and the wall links
  // exactly as before. Turn on with VITE_ENABLE_PERSON_HUB=true (Vercel env) -- no code change.
  personHub:           import.meta.env.VITE_ENABLE_PERSON_HUB === 'true',
  // The three people worlds (teacher timetable, DJ sleeve, dancer card) built on
  // src/modules/person-page/{facts,frame,worlds}. OFF = every role page exactly as before.
  // Turn on with VITE_ENABLE_PERSON_WORLDS=true (Vercel env) -- no code change.
  personWorlds:        import.meta.env.VITE_ENABLE_PERSON_WORLDS === 'true',
  // Self-owned RUM (web-vitals -> record_web_vital_v1, see lib/webVitals.ts).
  // OFF until the admin-repo migration ships the RPC; flipping this in Vercel
  // env enables reporting with no code change.
  rum:                 import.meta.env.VITE_ENABLE_RUM === 'true',
  // Analytics: event and profile view tracking (Phase 1 IO optimization).
  // Temporarily OFF to reduce Supabase Disk IO while analytics are moved to
  // external storage (Vercel KV / S3). Re-enable after Phase 2 completes.
  // Default: true in dev, false in prod until Phase 2 migration lands.
  enableEventTracking: import.meta.env.VITE_ENABLE_EVENT_TRACKING !== 'false',
  // "Seen in lists" impressions (src/lib/listImpressions.ts -> record_list_impressions_v1).
  // ON unless the env var is exactly 'false' (the off switch); also honours enableEventTracking.
  listImpressions: import.meta.env.VITE_ENABLE_LIST_IMPRESSIONS !== 'false',
  enableProfileTracking: import.meta.env.VITE_ENABLE_PROFILE_TRACKING !== 'false',
  // Organiser self-serve (Lever 2: /account, onboarding, organiser home).
  // OFF in production until launch; the route redirects home and the header
  // shows no account entry while false.
  organiserSelfServe:  import.meta.env.VITE_ENABLE_ORGANISER_SELF_SERVE === 'true',
  // The P3 organiser redesign (mockup C3, docs/organiser-rebuild/p3/CONTRACT.md):
  // the /account/p3 area. OFF = no P3 route exists and every organiser screen is
  // exactly as before. Separate from parityGate's AW1_APPLIED (a code constant).
  // Turn on with VITE_ENABLE_ORGANISER_P3=true (Vercel env) -- no code change.
  organiserP3:         import.meta.env.VITE_ENABLE_ORGANISER_P3 === 'true',
  // Event links point at https://<name>.bachatacalendar.co.uk (brief D2b, src/lib/seo/eventHref.ts).
  // OFF = today's /event/<slug> links. Turn on with VITE_ENABLE_EVENT_SUBDOMAIN_LINKS=true (Vercel env).
  eventSubdomainLinks: import.meta.env.VITE_ENABLE_EVENT_SUBDOMAIN_LINKS === 'true',
  // Teacher picker lists all teachers with an empty search (layout B). OFF = today's picker.
  // Turn on with VITE_ENABLE_ORGANISER_PICKER_LIST=true (Vercel env) -- no code change.
  organiserPickerList: import.meta.env.VITE_ENABLE_ORGANISER_PICKER_LIST === 'true',
  // Start a P3 New event from a flyer photo (docs/design/flyer-read-screen.md). Needs organiserP3
  // and organiserSelfServe too. OFF = the New event kind step is exactly as before.
  // Turn on with VITE_ENABLE_ORGANISER_FLYER_READER=true (Vercel env) -- no code change.
  organiserFlyerReader: import.meta.env.VITE_ENABLE_ORGANISER_FLYER_READER === 'true',
  // Organiser ticketing (S3, docs/organiser-ticketing-journey.md): P3's Get paid, ticket
  // types, sales, refunds and door. OFF = none of them shows. Turn on with
  // VITE_ENABLE_ORGANISER_TICKETING=true (Vercel env) -- no code change.
  // Organiser dashboard slice 1 (admin #1535): hero + date rail Home. OFF = the current Home.
  // Turn on with VITE_ENABLE_ORGANISER_DASH=true (Vercel env) -- no code change.
  organiserDash:       import.meta.env.VITE_ENABLE_ORGANISER_DASH === 'true',
  // Claim-first organiser invite (docs/briefs/claim-first-organiser-invite.md): /invite shows the
  // organisation to take over FIRST, then a separate "Now about you" step. OFF = /invite exactly as before.
  // Turn on with VITE_ENABLE_CLAIM_FIRST_INVITE=true (Vercel env) -- no code change.
  claimFirstInvite:    import.meta.env.VITE_ENABLE_CLAIM_FIRST_INVITE === 'true',
  // Organiser guest list inside each night (admin #1577, NOT applied to prod yet). Needs organiserDash. OFF = the night
  // sheet shows a Coming soon card and no guest-list RPC is called. Turn on with VITE_ENABLE_ORGANISER_GUEST_LIST_LIVE=true
  // only after #1577 is applied.
  organiserGuestListLive: import.meta.env.VITE_ENABLE_ORGANISER_GUEST_LIST_LIVE === 'true',
  organiserTicketing:  import.meta.env.VITE_ENABLE_ORGANISER_TICKETING === 'true',
  // Organiser people picker: full-screen search with profile photos on the session sheet. Needs organiserP3.
  // OFF = the inline search box and Add button, exactly as before. Turn on with
  // VITE_ENABLE_ORGANISER_PEOPLE_PICKER=true (Vercel env) -- no code change.
  organiserPeoplePicker: import.meta.env.VITE_ENABLE_ORGANISER_PEOPLE_PICKER === 'true',
  // Organiser Event Editor v2, slice S1 (docs/briefs/editor-v2-s1.md on brief/editor-v2-s1c): weekly and one-off
  // events get the v2 event page, night screen and save bar in place of Edit night. OFF = today's screens, no new route.
  // Turn on with VITE_ENABLE_ORGANISER_EDITOR_V2=true (Vercel env) -- no code change
  organiserEditorV2: import.meta.env.VITE_ENABLE_ORGANISER_EDITOR_V2 === 'true',
  // R4 cancel refund, slice C (docs/briefs/r4-cancel-refund-c.md on brief/r4-cancel-refund-c): on a cancelled night
  // the owner seat / admin sees what is left to refund with Refund all and a per-order Refund, and the door list is
  // hidden. Needs organiserTicketing. OFF = the night page is exactly as before and no refund read is called.
  // Turn on with VITE_ENABLE_ORGANISER_CANCEL_REFUND=true (Vercel env) -- no code change.
  organiserCancelRefund: import.meta.env.VITE_ENABLE_ORGANISER_CANCEL_REFUND === 'true',
  // T3 price steps (docs/briefs/ticket-t3-price-steps-editor.md): the "Price changes" block in the
  // ticket editor. Needs organiserTicketing. OFF = the editor is exactly as before.
  // Turn on with VITE_ENABLE_TICKET_PRICE_STEPS_EDITOR=true (Vercel env) -- no code change.
  ticketPriceStepsEditor: import.meta.env.VITE_ENABLE_TICKET_PRICE_STEPS_EDITOR === 'true',
  // T5 course tickets + early-bird presets (docs/briefs/ticket-t5-course-presets.md): "A course" on a new ticket
  // and preset price changes on a saved paid course. Needs organiserTicketing and ticketPriceStepsEditor.
  // OFF = the editor is exactly as before. Turn on with VITE_ENABLE_TICKET_COURSE_PRESETS=true (Vercel env).
  ticketCoursePresets: import.meta.env.VITE_ENABLE_TICKET_COURSE_PRESETS === 'true',
  // Gallery sheet: choose photo order and the cover (tap a photo, then Move left/right, Make cover).
  // OFF = the sheet is exactly as before. Turn on with VITE_ENABLE_ORGANISER_PHOTO_ORDER=true (Vercel env).
  organiserPhotoOrder: import.meta.env.VITE_ENABLE_ORGANISER_PHOTO_ORDER === 'true',
  // Organiser Raffle inside each night (Option B). Admin PR #1576 (organiser_raffle_nights_v1 and
  // organiser_raffle_night_set_v1) is NOT applied to prod yet: OFF = the night sheet's Raffle row is a Coming soon
  // card and no raffle RPC is called. Default ON (2026-11-24): off only with VITE_ENABLE_ORGANISER_RAFFLE_LIVE=false.
  organiserRaffleLive: import.meta.env.VITE_ENABLE_ORGANISER_RAFFLE_LIVE !== 'false',
  // Buyer ticket checkout (S4, docs/ticketing-buyer-journey.md): the Tickets block on
  // /event/:id and the /tickets/thanks return page. OFF = no block, no route. Turn on with
  // VITE_ENABLE_PUBLIC_TICKETING=true (Vercel env) -- no code change.
  publicTicketing:     import.meta.env.VITE_ENABLE_PUBLIC_TICKETING === 'true',
  // T4 buyer price steps: read ticket_types_public_v3, post the basket body with expected prices
  // (edge v5 path), "Price rises on <date>" on the card, price_changed confirm. OFF = the old body
  // and the v2 read, exactly as before. Turn on with VITE_ENABLE_TICKET_PRICE_STEPS=true.
  ticketPriceSteps:    import.meta.env.VITE_ENABLE_TICKET_PRICE_STEPS === 'true',
  // Ticket picker B1 (docs/briefs/ticket-buyer-picker.md): the white checkout (pick, email, 6-digit code,
  // Stripe) behind "Get tickets". Needs publicTicketing. OFF = the Tickets page is exactly as before.
  // Turn on with VITE_ENABLE_TICKET_PICKER_B1=true (Vercel env) -- no code change.
  ticketPickerB1:      import.meta.env.VITE_ENABLE_TICKET_PICKER_B1 === 'true',
  // Homepage polish + menu sheet (docs/briefs/home-polish.md): chip row (Nearest/Party/Class/Fest), Today tab,
  // logo + menu button header with a full-screen menu sheet and search, no BottomNav, map strip option 3.
  // OFF = every screen exactly as before. Turn on with VITE_ENABLE_HOME_POLISH=true (Vercel env) -- no code change.
  homePolish:          import.meta.env.VITE_ENABLE_HOME_POLISH === 'true',
  // Near me (docs/briefs/near-me.md): one shared location provider, a 30-minute remembered fix,
  // tilde distances, split denial copy. Needs homePolish ON to show the chip row.
  // OFF = every screen exactly as before. Turn on with VITE_ENABLE_NEAR_ME=true (Vercel env) -- no code change.
  nearMe:              import.meta.env.VITE_ENABLE_NEAR_ME === 'true',
  // Home feed look (docs/briefs/home-feed-look.md): folder tabs joined to the map, poster-word category row
  // (Near me inside it), poster-thumb feed rows. Needs homePolish ON (it builds on that chip row + Today tab).
  // OFF = every screen exactly as before. Turn on with VITE_ENABLE_HOME_FEED_LOOK=true (Vercel env) -- no code change.
  homeFeedLook:        import.meta.env.VITE_ENABLE_HOME_FEED_LOOK === 'true' && import.meta.env.VITE_ENABLE_HOME_POLISH === 'true',
  // Home one filter row (site structure S2d-1, docs/arcs/site-structure.md): the folder tabs go, the poster row
  // becomes Today / Weekend / Near me / Party / Class / Festival (one at a time; tap again = everything).
  // Needs homeFeedLook ON. OFF = home exactly as before. Turn on with VITE_ENABLE_HOME_ONE_ROW=true (Vercel env).
  homeOneRow:          import.meta.env.VITE_ENABLE_HOME_ONE_ROW === 'true' && import.meta.env.VITE_ENABLE_HOME_FEED_LOOK === 'true' && import.meta.env.VITE_ENABLE_HOME_POLISH === 'true',
  // Dashboard switch, Round-4 everywhere (docs/briefs/dashboard-switch-build.md): the Switch profile sheet in the
  // dancer app and organiser area, the organiser Switch page and the Sign out link at the foot of Account settings.
  // OFF = every screen exactly as before. Turn on with VITE_ENABLE_DASHBOARD_SWITCH_R4=true (Vercel env) -- no code change.
  dashboardSwitchR4:   import.meta.env.VITE_ENABLE_DASHBOARD_SWITCH_R4 === 'true',
  // Course rule card (docs/briefs/course-rule-card.md on brief/course-rule): "Sign up before you come" /
  // "Drop in welcome" above the Week rows on a course page, from event.signup_rule (admin #2037).
  // OFF = the course page is exactly as before. Turn on with VITE_ENABLE_COURSE_SIGNUP_RULE=true (Vercel env).
  courseSignupRule:    import.meta.env.VITE_ENABLE_COURSE_SIGNUP_RULE === 'true',
  // Stripe for organisers v2 S2a: one Stripe status card on organiser Home and Tickets. OFF = both screens as before.
  // Turn on with VITE_ENABLE_STRIPE_NUDGE_V2=true (Vercel env) -- no code change.
  stripeNudgeV2:       import.meta.env.VITE_ENABLE_STRIPE_NUDGE_V2 === 'true',
  // Finished / cancelled night notes on the event page (docs: brief #2148): a finished-night card and a cancelled-night
  // red bar, each with a button to the next night. OFF = the event page is exactly as before.
  // Turn on with VITE_ENABLE_NIGHT_NOTES=true (Vercel env) -- no code change.
  nightNotes:          import.meta.env.VITE_ENABLE_NIGHT_NOTES === 'true',
  // Organiser Team R2 (brief #2161): one list with two switches (Can sign in / On public page) + Recent changes.
  // OFF = the R4Team screen exactly as before. Turn on with VITE_ENABLE_ORGANISER_TEAM_R2=true (Vercel env).
  organiserTeamR2:     import.meta.env.VITE_ENABLE_ORGANISER_TEAM_R2 === 'true',
  // Organiser Team R3 W1 (brief #2179): Undo button on the owner's Recent changes rows.
  // OFF = the R2 screen exactly as before. Turn on with VITE_ENABLE_ORGANISER_TEAM_R3=true (Vercel env).
  organiserTeamR3:     import.meta.env.VITE_ENABLE_ORGANISER_TEAM_R3 === 'true',
  // Organiser teachers forward (brief #2245): after changing a class's teachers on one night, ask "Just this date" or
  // "This date and all later dates". OFF = the When sheet saves as before. Turn on with VITE_ENABLE_ORGANISER_TEACHERS_FORWARD=true.
  organiserTeachersForward: import.meta.env.VITE_ENABLE_ORGANISER_TEACHERS_FORWARD === 'true',
  // Organiser class invites (brief #2247): invite a named teacher who is not on the site, from a stored class's Teachers group.
  // OFF = the session sheet is exactly as before. Stays OFF in production until /join/class/:token ships. VITE_ENABLE_ORGANISER_CLASS_INVITES=true.
  organiserClassInvites: import.meta.env.VITE_ENABLE_ORGANISER_CLASS_INVITES === 'true',
  // Raffle data requests (brief #2227): one line in /privacy to a /privacy/raffle-data page with an Email us button,
  // and "You agreed on 24 Nov 2026" on the export page. OFF = every screen exactly as before.
  // Turn on with VITE_ENABLE_RAFFLE_PRIVACY_LINE=true (Vercel env) -- no code change.
  rafflePrivacyLine:   import.meta.env.VITE_ENABLE_RAFFLE_PRIVACY_LINE === 'true',
  // Raffle waiting (brief #2233): once the visitor is in, the event-page raffle tile shows "Recent winners"
  // (up to 6) and "The more draws you're in, the more chances you get." OFF = today's tile, unchanged.
  // Turn on with VITE_ENABLE_RAFFLE_WINNERS_WALL=true (Vercel env) -- no code change.
  raffleWinnersWall:   import.meta.env.VITE_ENABLE_RAFFLE_WINNERS_WALL === 'true',
} as const;

// Section value submitted to submit_listing_request_v1 — must match the
// admin-repo `listing_request_section` enum exactly.
export type ListingSection =
  | 'teachers_directory'
  | 'teacher_detail'
  | 'organisers_directory'
  | 'organiser_detail'
  | 'venue_detail';
