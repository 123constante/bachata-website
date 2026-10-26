# Brief: Bristol polish PR (Website only; normal lane; no DB change)

Branch: `claude/bristol-polish`. ONE PR (bot-authored via the claude/** push). Read first: `git fetch origin claude/bristol-audit` then `git show FETCH_HEAD:docs/audits/bristol-audit-2026-10-26.md` (Part 1 table, ranked gaps, section 6 fix sketches, Part 4). Code at current `origin/main`.

## Goal (owner's words, 2026-10-26)
Bristol (`bristol-gb`, currently inactive) will be switched on by the owner once these fixes land. Until then you cannot see it live: test with an ACTIVE-but-empty stand-in by passing the Bristol slug/id to the same code paths (unit tests with mocked city data; no DB write; Supabase is read-only). Owner decisions: empty pages say "Coming soon" + a "Tell us" action; Bristol only (no Bath/Cardiff); all roles live at launch.

## Scope (all Website-only)
1. City-aware titles and intros: pass `cityDisplay` (from `useCity`) into `buildSeoForRoute` for Parties, Classes, Tonight, Venues, Organisers, Dancers, DJs; London-only guide links and "in London" copy only when the city is London. Prerendered `/parties` and `/classes` stay London.
2. One shared empty-city note component: "Nothing listed in <City> yet. Run a night or know a teacher? Tell us" opening the form. Use on home feed, Tonight, Venues, Organisers, Dancers, DJs and search-no-results (search says "Nothing in <City> yet" + "Search all cities"). Every empty state names what the person CAN do.
3. Teacher variant of `ListingRequestForm`: heading and label "Their profile or Instagram link" (not "Event link"), teacher success text, and the page/city carried in `source_url` as today (no DB or edge change; the RPC still requires a `^https?://` link, so accept an Instagram handle by normalising to a URL client-side and say so in the field hint). Every other caller of the form keeps its event wording (table-driven test over every caller x wording).
4. Map: when the city has no pins, centre on the city (use `cities` lat/lng if the data has it, else a per-city constant table with London as default) instead of the hard-coded London centre (`EventMap.tsx`, `HomeMapCard.tsx`, `CityMap.tsx`).
5. Venues: filter the list to the page city on the client by `city_name`; a city with none shows the shared empty note. London page output must be byte-identical for London (guard with a test).
6. Off-city festivals in "What's on in <City>": label the group "Festivals elsewhere" when the city is not the festival's city.

## DO NOT TOUCH (CLAUDE.md density exclusions; owner: "ask me when I see it")
`src/components/EventCalendar.tsx`, `src/components/calendar/*` (CalendarGrid, CalendarListView, DayDetailModal, calendarUtils), `src/hooks/useCalendarEvents.tsx`, `src/components/ui/dialog.tsx`. Instead include in the design record a mockup (HTML or description) of the empty-city note in the calendar list and day modal for the owner to approve.
Also out of scope: `/` redirect, sitemap, canonical, `/cities` page, organisers city scope, invites, any DB/RPC/migration, any flag, activating Bristol.

## Rules for this repo (read, do not restate in the PR)
- `CLAUDE.md` Website: compact density, explicit px tap targets (>= 44px), HTML entities in JSX (`&mdash;`, `&rsquo;`), source files over 2 KB through `scripts/safe-edit.py` / `safe-write.py`, no `.sql`, breadcrumbs via `buildBreadcrumbs`.
- Design Gate: write `docs/design/<pr>.md` (brief, chosen approach, self-checks: contrast >= 4.5, taps >= 44px, no clipping, no sideways scroll, every empty/loading/error state actionable). Walk at 390x844 if your sandbox can; otherwise say Not verified.
- Definition of done: table-driven consistency tests, every screen x every shape (0 / 1 / many items; London vs Bristol vs a city with no cityDisplay). Run every CI job step that applies (read `.github/workflows`), put the per-job table in the PR body. Verified / Not verified block in the PR body.
- One slice = one branch = one push (Vercel cap): push once at the end, final subject ends `[worker-done <ticket>]`.
- Context cap 50% (normal lane); at 45% start nothing new and push a PARTIAL handover.
