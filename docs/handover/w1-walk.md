# W1 walk: phone pictures + measurements of PR #893

BEFORE = `origin/main` (`fb91b8a`). AFTER = `claude/w1-people-surfaces` (`8166f0b`, PR #893).
No product code changed. Pictures: `docs/mockups/w1-walk/` (one `-before`, `-after` and `-compare` PNG per screen, 390x844 @2x).

## Setup (what is true about these pictures)
- Both trees built with `npm run build` using prod's public URL (`stsdtacfauprzrdebmzg`) and anon key, served with `node --conditions=production scripts/_serve-build.mjs`, driven with Playwright chromium (isMobile, DPR 2). `location.pathname` and the h1 were recorded on every load.
- **Flags.** The Vercel API is blocked by the sandbox proxy (403), so prod's real flag values are NOT known: **needs owner: Vercel token / flag check.** I built BOTH trees twice:
  - flags off (the default build): `/teachers`, `/organisers` and their detail pages show "Coming soon" (only used for shot 09, the visitor view);
  - flags on (`VITE_ENABLE_TEACHERS_DIRECTORY`, `_TEACHER_DETAIL`, `_ORGANISERS_DIRECTORY`, `_ORGANISER_DETAIL` = true): used for every other shot and all measurements. The organiser team strip is only visible with the organiser flag on.
- Photo hosts (`pub-07f6...r2.dev`, `media.bachatacalendar.co.uk`, `flagcdn.com`) are blocked, so portraits are initials or a broken-image glyph. Not a code problem.
- BEFORE and AFTER pages differ in length and column count (/djs is 2 columns Today, 3 After; /dancers 4 vs 3), so "same scroll position" is only approximate; each caption says what to look at. Shot 04 (BEFORE) is a different part of the list.

## Screens (real people / events; names only)
| # | Screen | Used | Compare sheet |
|---|---|---|---|
| 01 | /djs top | - | `01-djs-top-compare.png` |
| 02 | /djs tile with 3 tags | Daniel Carbonero (Teacher, DJ, Dancer) | `02-djs-tile-compare.png` |
| 03 | /dancers top | - | `03-dancers-top-compare.png` |
| 04 | /dancers row | Bisket (Teacher, DJ) | `04-dancers-row-compare.png` |
| 05/06 | DJ page, no photo | Carlos De La Cruz (hero; top-of-page share area) | `05-...`, `06-...` |
| 07/08 | DJ page, "DJ " name | El Rugido (page slug `/djs/nico`) | `07-...`, `08-...` |
| 09 | Teacher page, visitor view (flags off) | Javier (`/teachers/<dancer id>`) | `09-teacher-closed-compare.png` |
| 09b | Same, flags on | Javier | `09b-teacher-flags-on-compare.png` |
| 10 | Dancer who is a DJ | Bisket / "Oreo Sensual" | `10-dancer-dj-compare.png` |
| 11 | Organiser team strip | Unidos Flow ("Teachers & DJs" row: Nico, Gabriel Bravo) | `11-organiser-team-compare.png` |
| 12 | Event lineup | Pura Nights Ealing (Melita Somos: Teacher + DJ) | `12-event-lineup-compare.png` |
| 13/13b | Header search | "Rugido", then "Nico" | `13-...`, `13b-...` |
| 14 | /faq after client nav from /dancers | bottom + footer | `14-faq-bottom-compare.png` |
| 15 | C1, AFTER only | /dancers with the badges RPC routed to 500 | `15-c1-badges-500-after.png` |

There is no "contact" control on DJ pages in either build; the only share/contact control is **Share** (AFTER, top of page). BEFORE has no Share button on DJ pages; its shot is the top of the page.

## Measurements on AFTER (390x844 and 360x640)
| measure | result (both widths unless noted) |
|---|---|
| Horizontal scroll (`scrollWidth` vs `innerWidth`) | none on every page: 390/390 and 360/360 on /djs, /dancers, both DJ pages, teacher, dancer-DJ, organiser, event, search overlay |
| Clipped text (`scrollWidth > clientWidth`) | A broad scan counts many elements, but they are skip links, screen-reader-only commas/labels and ellipsis-by-design (instagram URL, venue line). Targeted scan of tiles, h1/h2, buttons: **no clipped name or role label** on /djs, /dancers, DJ pages, organiser team strip at 390. At 360 the only non-by-design clip is the related-event title "Rogue Bachata Wednesday" on the event page (ellipsis in a card; same Today). Visual check of shots agrees: three-tag tiles wrap to two lines inside the tile |
| `elementFromPoint` at tile/chip/button centres | /djs 62/62, /dancers 117/117, Carlos 25/25, El Rugido 27/27, teacher 1/1, dancer-DJ 29/29, organiser 41/41 (both widths). Event page 44/49 (390) and 47/49 (360): the misses are bottom-bar buttons ("Get Tickets" bar, footer links) that sit under the fixed action bar when scrolled; same bar Today. Search overlay: the page links behind the overlay are covered by design (1/118) |
| Contrast: "Playing soon" | rgb(252,211,77) on rgb(10,8,11), 12px/600 = **13.84:1** |
| Contrast: role labels | /djs tile labels not text-matched (grey); DJ page chips: Teacher 17.76:1, Dancer 11.38:1; dancer page: Teacher 18.00:1, "DJ · Oreo Sensual" 11.01:1; organiser team tags 11.26:1 (12px/700); event lineup: "DJ" 4.69:1 (12px/600, rgb(177,141,78) on rgb(26,45,39)), "Organiser" 6.79:1 |
| Text pointing at a missing control | none found. "Press Enter to search all" is in the search box; "Back to the calendar" is on the 404 |
| Empty / error states | Search no-result: "No results. Press Enter to search all." (says what to do). Teacher 404: "Back to the calendar" button. Teacher closed: "Coming soon" (no action offered; same Today) |
| **C1** badges RPC -> 500 | `/dancers` stays on /dancers, h1 "Meet Dancers", RPC called 2x, **164 tiles, 0 "No dancers yet"**, no role labels (shot 15). PASS. Unfiltered list includes test-looking rows (known, accepted) |
| Console errors (AFTER) | none from the app on /djs, /dancers, DJ pages, dancer-DJ, organiser, event. Only blocked-host `ERR_TUNNEL_CONNECTION_FAILED` for photos/flags (sandbox). Teacher URL: one 404 resource (expected, the page is not found). C1 page: 2x 500 + one logged "Query error: boom" from `lib-people` (expected, I injected it) |
| Console errors (BEFORE) | same set: blocked hosts only, same 404 on the teacher URL |
| /faq after client navigation | `/dancers` -> tap FAQ -> `/faq`: html and body both rgb(14,18,21), band above the footer matches (picture 14 shows no strip). Today (BEFORE) still paints the pink/purple dancer ground with stars above the footer |

## Things that look WRONG or odd on AFTER (ranked, plain words)
1. **Search can't find "Rugido".** Typing "Rugido" or "El Rugido" gives "No results" (same Today); the DJ is only found as "Nico". The search service matches the real name, not the stage name. Not caused by #893 and not fixable in this PR, but the owner's example fails.
2. **DJ vinyl label is cut off for names starting "DJ ".** On El Rugido's hero the vinyl centre reads "DJ El Rugi" with both ends clipped by the disc (same Today). Carlos De La Cruz ("DC" initials) looks right.
3. **Search shows the same person three times** (Nico as Teacher, DJ and Dancer), each row with one role word. Same Today; the shared row function did not change the visible rows.
4. **Teacher chip links to the DJ page.** On the Pura Nights lineup, Melita Somos's "Teacher" chip now opens `/djs/...` (DJ > dancer > teacher order) whereas Today it opened `/teachers/...` (which is "Page not found"). Intended by the link-order rule, but a visitor tapping "Teacher" lands on a DJ page.
5. **"Teacher" link on DJ and dancer pages is plain text**, while Dancer / "DJ · Oreo Sensual" are filled chips. Looks unfinished or inconsistent (shots 07, 10).
6. **/djs and /dancers change shape**: /djs goes 2 -> 3 columns; /dancers goes 4 -> 3 columns and now lists Teachers and DJs as well as dancers (Bisket was not in Today's list). Probably intended; the owner should know.
7. **Teacher page for Javier is "Page not found"** with the flags on (both trees): his id is a dancer id, no teacher page exists. Flags off: "Coming soon".
8. Leoncio's tile on /dancers has no label at all (blank space where a label would be).

## Verified / Not verified
**Verified**
- Both trees built and served; pathname and h1 recorded per load (see raw notes in the run); pictures taken at 390x844 @2x, measures at 390 and 360.
- No horizontal scroll, no hit-test misses on tiles/chips/primary buttons (except the fixed-bar overlap noted), contrast numbers above measured from computed styles.
- C1 never says "No dancers yet".
- /faq after client navigation: no strip on AFTER.
- Search "Nico" rows, organiser team strip, event lineup chips checked by eye in the compare sheets.

**Not verified**
- Prod's real feature-flag values (Vercel API blocked; flags-on and flags-off builds shown instead).
- Real photos (hosts blocked), a real phone, a Vercel preview.
- A per-label clipped count on /djs tiles (broad scan too noisy; judged from shots and Phone QA from the finish pass: 0/40).
- The 360px width was measured only (no 360 pictures; the brief asked 360 for tables only).
- BEFORE measurements (only console and visuals compared).
