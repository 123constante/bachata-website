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
  // Self-owned RUM (web-vitals -> record_web_vital_v1, see lib/webVitals.ts).
  // OFF until the admin-repo migration ships the RPC; flipping this in Vercel
  // env enables reporting with no code change.
  rum:                 import.meta.env.VITE_ENABLE_RUM === 'true',
} as const;

// Section value submitted to submit_listing_request_v1 — must match the
// admin-repo `listing_request_section` enum exactly.
export type ListingSection =
  | 'teachers_directory'
  | 'teacher_detail'
  | 'organisers_directory'
  | 'organiser_detail'
  | 'venue_detail';
