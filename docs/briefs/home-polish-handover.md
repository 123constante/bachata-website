# Handover: home-polish (branch claude/home-polish)

Brief: `docs/briefs/home-polish.md` (branch brief/home-polish). Everything sits behind `flags.homePolish`
(`VITE_ENABLE_HOME_POLISH=true`), default OFF.

## Done
- Chip row (Use my location / Nearest / Location off / Finding you -> Still looking + Cancel; Party, Class, Fest multi filters,
  map dot colours), zero-results + Clear filters, far-from-you (>60 mi) + Clear with date order kept, Nearest preference
  remembered (flag only) and restored only when permissions.query already says granted.
- Tabs: Tonight -> Today (look unchanged). Distances already on rows when located.
- Header: logo + 44px menu button. Full-screen MenuSheet (portal, aria-modal, focus trap, Escape back one level):
  search bar, Sign in / My profile, organiser rows (Organiser dashboard, Sell tickets), Dancers, Teachers, DJs,
  Organisers, Venues, Raffles (rafflesPage), Festivals, Cities and countries, Community; footer theme (disabled: no light
  theme exists), Instagram, WhatsApp, Rate us on Google, Support us (3 Stripe links).
- Full-screen search: recent searches + Clear, All/Events/People/Venues chips, back arrow to menu.
- BottomNav removed (AppChrome). Map option 3 (live chip, N venues + 44px Open map, 148px kept, heading sr-only).
- Badges 11px, end-of-feed link block (rows shared with the menu model).
- useGeolocation: clear() now cancels an in-flight request (generation guard) -- affects flag OFF too (bug fix).
- Tests: `src/modules/home-polish/__tests__/homePolish.matrix.test.ts`.

## Left (not built)
- One shared geolocation PROVIDER (useMapList, CityMap, Tonight still each own one); permissions change listener (Safari
  fallback); {lat,lng,accuracy,ts} storage with 30-min expiry; "~" distances / Rough location for >5 km accuracy;
  denial copy split by browser/PWA; per-reason error count in useGeolocation onError; retry cap / loading guard on Try again.
- "Sell tickets" goes to the organiser area events list (`/account/p3/events` when P3 is live) -- owner to confirm target.
- Search chips filter the omnibox's 3-per-kind results; a fuller per-kind search would need a bigger limit.
- far-from-you looks only at rows loaded so far.
- Pre-existing flake: `allEventsList.city.test.tsx > 'Bristol, 0 rows'` fails ~half the runs on main too.

## Next steps
1. Owner phone test with the flag on a preview (set VITE_ENABLE_HOME_POLISH=true on the preview env).
2. Build the location-spec items above as a follow-up PR.
3. `npm run pre-ship` end to end (did not finish inside the worker session; typecheck baseline there is 106 but main is 139).
