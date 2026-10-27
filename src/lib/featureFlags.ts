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
  // Organiser ticketing (S3, docs/organiser-ticketing-journey.md): the /account/tickets
  // area -- Get paid, ticket types, sales, refunds. OFF = no route at all. Turn on with
  // VITE_ENABLE_ORGANISER_TICKETING=true (Vercel env) -- no code change.
  organiserTicketing:  import.meta.env.VITE_ENABLE_ORGANISER_TICKETING === 'true',
} as const;

// Section value submitted to submit_listing_request_v1 — must match the
// admin-repo `listing_request_section` enum exactly.
export type ListingSection =
  | 'teachers_directory'
  | 'teacher_detail'
  | 'organisers_directory'
  | 'organiser_detail'
  | 'venue_detail';
