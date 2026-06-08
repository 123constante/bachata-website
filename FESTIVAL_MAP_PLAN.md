# Festival Map homepage — implementation plan

Replace the current homepage (`src/pages/Index.tsx`, served at `/city/:slug`)
with a map-centric event-discovery surface from the `design_handoff_festival_map`
handoff.

## Locked decisions

| Question | Decision |
|----------|----------|
| Coordinate data path | **New admin RPC** `get_map_events_v1` (coords in one call) |
| Scope | **Mobile bottom-sheet + one desktop direction together** |
| Mobile chrome | **Keep** existing `GlobalHeader` + `BottomNav` |
| Desktop chrome | **New full-bleed design**; suppress `GlobalFooter` + `BottomNav` on desktop home |
| Desktop nav | **Reuse `GlobalHeader`** (no second nav) |
| Desktop layout | **Map left / dense list right** (user's stated intent — see note) |

> **A/B label note.** The handoff README labels "Direction B" as map-left/list-right,
> but its `DirB` JSX is actually list-left/map-right. We build to the *stated intent*
> (map left, denser list right). In the prototype's own code that geometry matches
> `DirA` (`55% map | 45% list`) with the list in dense mode. Letter is irrelevant;
> geometry is fixed.

## Current-state facts (audited)

- `Index` is the `/city/:slug` + `/city/:slug/calendar` route (`AnimatedRoutes.tsx:113-114`).
  `/` redirects to a city.
- Global chrome lives in `App.tsx:69-82`, wrapping the route outlet:
  `GlobalHeader` (`fixed h-[60px] z-[60]`) + 60px spacer + `GlobalFooter` +
  bottom-nav spacer + `BottomNav` (`fixed bottom-0 z-50`). **None are breakpoint-gated today.**
- `get_calendar_events_v2` (`useCalendarEventsRpc.ts`) returns events but **no lat/lng**.
- `venues` carry `lat`/`lng` (enforced by `check-venue-coords` contract + trigger).
- `useGeolocation` hook already exists (`hooks/useGeolocation.ts`, returns `{lat,lng}`) — reuse for "Tonight" distances.
- No map library installed. Vite manual chunks: `vendor-react/query/motion/supabase/ui` (`vite.config.ts:41-46`).
- Day-rollover lib `src/lib/programDayRollover.ts` — reuse for Calendar grouping; must stay mirrored with admin.

---

## Phase 0 — Data (admin repo `bachata-admin-11april`)

**New RPC `get_map_events_v1(city_slug_param text, range_start timestamptz, range_end timestamptz)`**
returning one row per occurrence with everything the map + cards need:

```
occurrence_id, event_id, name, cover_image_url,
venue_name, area, city_slug,
lat, lng,                       -- COALESCE(co.venue_id, e.venue_id) -> venues.lat/lng
instance_date, start_time, end_time,
type, has_party, has_class,     -- drives category color (class/party/mix/fest/social)
created_at, updated_at,         -- drives News tab "added/updated Xm ago" + badge=new
is_cancelled, cancellation_reason_label
```

- Venue join **must** use `COALESCE(co.venue_id, e.venue_id)` per the occurrence
  venue contract in CLAUDE.md. Rows with no resolvable venue coords return NULL
  lat/lng and simply don't get a pin (still listable).
- Author as a migration in `bachata-admin-11april/supabase/migrations/`, push via
  admin (MCP apply now permitted per memory; confirm-before-mutate). `NOTIFY pgrst`.
- **Website-side contract check** `scripts/check-map-events-rpc.mjs` (anon call,
  asserts shape + non-null coords for coord-resolvable venues) wired into
  `db-contract-check.yml` as a new numbered check.

**Website hook `src/hooks/useMapEvents.ts`** — React Query wrapper over the RPC,
keyed `['map-events', citySlug, rangeStart, rangeEnd]`, `staleTime` 5 min, mirroring
`useCalendarEventsRpc` conventions. Returns a typed `MapEvent[]`.

---

## Phase 1 — Map foundation (this repo)

- `npm i leaflet leaflet.markercluster` + `-D @types/leaflet @types/leaflet.markercluster`.
- New Vite manual chunk `vendor-map: ['leaflet','leaflet.markercluster']` so it never
  bloats `vendor-react`.
- `src/modules/home-map/EventMap.tsx`:
  - CARTO tiles (dark default; light/paper switchable later via theme token).
  - Poster-pin `L.divIcon` per event, gradient cover + monogram, colour from category.
  - `MarkerClusterGroup` for density.
  - Imperative API exposed via ref: `flyTo(idx)`, `zoom(±1)`, `reset()`,
    `setVisible(indices)`, `setGlow(indices)`, `setHot(idx)`.
  - **Lazy-loaded** (`React.lazy`) so only the homepage pays for Leaflet.
- Port `poster-realmap.css` (pins/popup/cluster) + the map bits of `desktop-realmap.css`
  into co-located CSS, scoped under a `.home-map` root to avoid global bleed.

## Phase 2 — Shared discovery state

`src/modules/home-map/useMapList.ts` (ported from prototype, wired to real data):

- State: `tab` (`all|tonight|news|cal`), `filter` (`all|parties|classes|festivals`),
  `q`, `sel`, `hover`, `day`.
- Derived: `listEvents`, `mapVisible`, `glow` — same rules as prototype
  (`directions.jsx:33-48`): News + empty-Calendar keep whole city on map for context;
  other tabs mirror the list; News glows `badge==='new'` pins.
- Real-data wiring:
  - **Tonight** = today's events (day-rollover aware) sorted by distance via `useGeolocation`.
  - **News** = events with recent `created_at`/`updated_at`; badge `new` vs `upd`,
    relative "Xm ago" label.
  - **Calendar** = month grid; dots from events grouped by rollover day; tap day -> filter list + map.
  - **Search** = title/venue/area substring; **chips** = category filter.

## Phase 3 — Mobile (the 95%)

`src/modules/home-map/MobileMapHome.tsx`:

- Map fills the gap between the existing `GlobalHeader` (60px) and `BottomNav` (~64px).
- Swipeable **bottom sheet** over the map: segmented tabs (All/Tonight/News/Calendar),
  search + chips on All, the four tab bodies.
- **Reuses** site chrome — the prototype's own top bar is dropped (site header is the
  single source of truth for nav + city switcher).
- Density rules apply (this Calendar UI is NEW, not the exempt `DayDetailModal`):
  p-3, gap-3, text-sm, full weekday names.

## Phase 4 — Desktop Direction B + chrome split

**Chrome controller (App.tsx):**
- Compute `isHome = !!matchPath('/city/:slug', pathname)` (and `/calendar` variant).
- On `isHome && desktop`: drop the 60px spacer's effect is fine (header stays), but
  `GlobalFooter` not rendered and `BottomNav` gated `md:hidden`. Mobile + all other
  pages unchanged. Implemented as a tiny conditional in the existing chrome block —
  no `fixed inset-0` overlay (avoids z-index/scroll fights with `z-[60]` header).

**`src/modules/home-map/DesktopMapHome.tsx`:**
- Below the reused `GlobalHeader`, a full-viewport-height grid: **`55% map (left) | 45% list (right)`**, list in dense mode.
- Port `desktop-realmap.css` (tabs, calendar grid, news rows, tonight distance cards,
  grouped list) scoped under `.home-map-desktop`.
- Full list<->map linking: hover card -> hot pin; click card -> `flyTo` + popup;
  click pin -> select + smooth-scroll list to `[data-evi]`.

**`Index.tsx`** becomes a thin responsive switch:
`isMobile ? <MobileMapHome/> : <DesktopMapHome/>`, both fed by one `useMapList` +
`useMapEvents`. Keeps `showSubheader={false}`, SEO JSON-LD, city display name.

---

## Cross-cutting

- **Tokens.** Map handoff theme palette (`--ink/--cream/--accent/--cat-*`) onto your
  existing Tailwind/CSS-var system; category colours: class `#46B7C9`, party `#E2415C`,
  mix `#B06CE0`, fest `#E8B450`, social `#5FBF7F`.
- **Fonts.** Reuse existing site fonts for body/UI; add **only Big Shoulders Display**
  for poster-pin monograms + cover art. No Hanken/Space Grotesk added.
- **HTML entities**, not raw Unicode (em-dash/ellipsis) in JSX.
- **safe-write.py** for any source file >2KB; `PYTHONUTF8=1`.
- **Breadcrumbs** stay off on home (`showSubheader={false}`).
- **Tests.** Contract test for `useMapEvents` shape; unit tests for `useMapList`
  derivations (listEvents/mapVisible/glow per tab); Playwright smoke: load home,
  switch tab, click card -> pin active.

## Suggested PR sequence

1. **PR A (admin):** `get_map_events_v1` migration + push.
2. **PR B (website):** `useMapEvents` + contract check + CI wiring.
3. **PR C (website):** map foundation (`EventMap`, deps, chunk) + `useMapList`.
4. **PR D (website):** `MobileMapHome` + `Index` switch (mobile ships first).
5. **PR E (website):** `DesktopMapHome` + App.tsx chrome split.

## Resolved decisions (was: open items)

1. **Fonts** — RESOLVED: reuse existing site fonts for all body/UI; add **only
   Big Shoulders Display** for poster-pin monograms + cover art (the one role
   existing fonts can't replicate). Keeps webfont weight off the mobile landing page.
2. **`going` (attendance count)** — RESOLVED: **drop from v1.** RPC omits `going`;
   no "X going" stat on cards/hero. Can add later.
3. **Tile theme** — RESOLVED: **dark CARTO** default (handoff look). Light/Positron
   switch deferred.
