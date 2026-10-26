# Design record: Bristol polish (branch `claude/bristol-polish`, 2026-10-26)

Brief: `brief/bristol-polish` `docs/briefs/bristol-polish.md` (sha 5fa9d35f). Audit: `claude/bristol-audit`
`docs/audits/bristol-audit-2026-10-26.md`. Website only: no DB, RPC, migration, flag, or Bristol activation.

## Brief

- **Who:** a dancer on a phone (390x844) who lands on a Bristol page once the owner switches Bristol on.
- **One job:** see straight away that Bristol is new, and what they can do about it.
- **Owner decisions:** empty pages say "Coming soon" and offer "Tell us"; Bristol only; all roles live at launch.

## Chosen approach

| Scope item | What changed | Where |
|---|---|---|
| 1. City-aware titles and intros | One mapping `resolvePageCity(slug)` -> `{ name, isLondon }`, used by every page. `cityDisplay` goes into `buildSeoForRoute` for Parties, Classes, Tonight, Venues, Organisers, Dancers and DJs. London guide links and "in London" copy show only for London. Bare `/parties` and `/classes` read the city from the URL only (`urlOnly`), so the prerendered HTML stays London and never meets a stored city at hydration. | `src/lib/pageCity.ts`, `src/hooks/usePageCity.ts`, the 7 pages |
| 2. One shared empty-city note | `EmptyCityNote`: "COMING SOON / Nothing listed in <City> yet. Run a night or know a teacher?" + **Tell us** (opens the listing form inline). Used on the home feed (What's on + Today tab), Tonight, Venues, Organisers, Dancers, DJs and search. Search says "Nothing in <City> yet for "q"" + **Search all cities** (`?city=all`, the RPC's `p_city_slug` NULL). On the global directories (Dancers, DJs, Organisers) the note sits above the everyone-list with "Showing everyone for now." | `src/components/listing/EmptyCityNote.tsx` |
| 3. Teacher form variant | `ListingRequestForm variant="teacher"`: heading "Know a teacher in <City>?", label "Their profile or Instagram link", hint saying an @name works, teacher success text. An @name or bare name becomes `https://instagram.com/<name>`, a bare domain gets `https://` (the RPC still requires `^https?://`). Section and `source_url` unchanged. Every other caller keeps the event copy (one copy map, tested per caller). | `src/components/listingRequestCopy.ts`, `ListingRequestForm.tsx`, `Teachers.tsx` |
| 4. Map centre | `cities` has no lat/lng (checked on prod), so it's a per-city table: London (default), Bristol. HomeMapCard centres on it and uses a ~50 km drag box. Greater London's box is unchanged. CityMap passes the centre too. `EventMap`'s default is untouched. | `src/lib/cityCentre.ts` |
| 5. Venues by city | `rowsForCity` cuts `get_public_venues_list_v4` rows to the page city by `city_name`. London is returned untouched. A golden HTML taken from `origin/main` 899f85e (same fixture and clock) guards **byte-identical** London output for `/venues` (stored city London and none) and `/city/london-gb/venues`. A city with none shows the note. | `Venues.tsx`, `venuesLondon.bytes.test.tsx` |
| 6. Festivals elsewhere | Outside London, a festival that the city query returned but that is in another city joins the remote section, now labelled **Festivals elsewhere**. "What's on in Bristol" then holds only Bristol rows. | `mapListDerivations.ts` `isOffCityFestival`, `AllEventsList.tsx` |

### Owner questions (not decided here)

1. **London's own off-city festivals.** London keeps today's behaviour: a Budapest festival that the London query returns
   still sits in London's stream, and the remote group is still called "Festivals further afield". Should London also get
   "Festivals elsewhere"? It's one line, but it changes the London home feed, so it was left out.
2. **Which inbox section an empty-city tip files under.** `listing_request_section` has no event value. "Run a night"
   tips go in as `organisers_directory` and venue tips as `venue_detail`. The page path in `source_url`
   (e.g. `/venues` or `/city/bristol-gb/venues`) is how you tell the city. On a bare route with a stored city, the path
   does NOT name the city. A real `kind`/`city` needs the careful lane (admin repo).
3. **Global directories.** Dancers, DJs and Organisers still list everyone (as today); a Bristol visitor sees the note
   plus "Showing everyone for now." Filtering them by city is a separate decision.

### Calendar list and day modal (DO NOT TOUCH files -- mockup for approval)

`EventCalendar.tsx`, `calendar/*`, `useCalendarEvents.tsx` and `ui/dialog.tsx` were **not** changed. Today a Bristol
month says "No events found for <Month>" with a "Clear filters" button, which is the wrong action for an empty city.
Proposed, using the same component:

```
 Calendar list (month has no rows, no filters on)      Day modal (day has no rows)
 +------------------------------------------+          +--------------------------------+
 | COMING SOON                              |          | Tue 4 Nov                    x |
 | Nothing listed in Bristol yet. Run a     |          | COMING SOON                    |
 | night or know a teacher?                 |          | Nothing listed in Bristol yet. |
 | [ Tell us ]                              |          | [ Tell us ]                    |
 +------------------------------------------+          +--------------------------------+
 "Clear filters" stays, but only when a filter is on.
```

London: unchanged ("No events found for <Month>"). This needs the owner's OK before anyone touches those files.

## Self-checks (Design Gate)

Walked in Chromium at **390x844** on a local dev server reading **prod** through the anon key (read-only). Bristol is
inactive, so `/city/bristol-gb/*` answers 404 at the edge. The stand-in is the stored city (`activeCitySlug=bristol-gb`)
on the bare routes, which run the same code paths. Results: `bristol-polish/walk.json`; pictures in `bristol-polish/`.

| Check | Result |
|---|---|
| Contrast >= 4.5 (axe `color-contrast` on the note) | 0 violations on all 6 Bristol screens |
| Taps >= 44px | "Tell us" and "Search all cities" are 44px (explicit `min-height: 44px`, not rem); "Send my details" too |
| No sideways scroll | none on 9 screens, with the form closed or open |
| No clipping | note and form fit at 390 (pictures) |
| Every empty / loading / error state actionable | the new empty states all carry "Tell us" (search adds "Search all cities"); London Tonight's "switch city" (no link) became a link to the parties listing. Loading and error states unchanged. |
| Titles | Bristol: "Bachata DJs / Dancers / Venues / Tonight / Organisers in Bristol"; London and no-city: "... in London" |
| Teacher form | `/city/bristol-gb/teachers` (still 404 at the gate, inactive-city fallback renders): heading "Know a teacher in Bristol?", label "Their profile or Instagram link", no "Event link" (`teachers-inactive-bristol-form.png`) |

## Handover

- **Done:** scope items 1-6, tests (see the PR body), the walk above.
- **Left / next:** owner answers to the three questions and the calendar mockup. Then switch Bristol on (owner,
  admin side), and walk `/city/bristol-gb`, `/city/bristol-gb/parties` and `/classes` once they stop answering 404.
