# S9 mockups: the remaining people surfaces in the Option 2 world (prototype, NO PR)

Repo: Website. Your branch: `claude/s9-mockups`, created FROM `origin/claude/s8-mockups` (it already has `/__mock/s8/...`, `src/modules/person-page/mockups/S8Mock.tsx` and fixtures). Read `docs/handover/s8-mockups.md` on that branch first, and `docs/design/people-surfaces/inventory.md` on `origin/claude/people-surfaces-inventory` (section 3 = the surface table, with files). Plain git only (never `gh api`). Commands without variables/loops/`$(...)` where a plain command works. PRODUCTION build (`VITE_MOCKS=true npm run build` + preview; use `NODE_OPTIONS=--max-old-space-size=3072` if the build runs out of memory) for every screenshot. Push ONCE; final subject ends `[worker-done <ticket>]`; 30% context rule (`PARTIAL [worker-done <ticket>]` + handover). Never merge, approve or open a PR. Supabase READ-ONLY. Do not change any live page: prototype files only (`src/modules/person-page/mockups/`, the dev-only `/__mock` route, docs).

## Owner decisions (made, do not re-ask)
- OPTION 2 chosen: separate linked role pages. Dancer page (teal ID card), DJ page (near-black + gold vinyl), teacher page each keep their own look and their own Share; a small "Also: DJ as <stage name> / Teaches / Dances" bar links a person's role pages. There is no combined person page.
- NAME RULE: the stage (DJ) name leads on DJ things (DJ list, DJ page, lineups, DJ search label); the real name everywhere else.
- SEARCH: one row per person with small role labels.
- THIN PAGES: hide empty parts. No "coming soon", no empty boxes, no defaults shown as facts, no DANCER label on someone who does not dance.
- Lead role = the role with something happening (DJ with upcoming gigs, else dancing).
- Roles are always public.

## Mock each surface as TODAY (real screenshot of the live component) vs OPTION 2 (mock), same real data
1. `/dancers` list (`src/pages/Dancers.tsx`). Today it lists all 164 active people, incl. teacher-only people and DJs. Option 2: only people who hold the dancing role; small role labels on a tile when the person also DJs/teaches; thin tiles (no photo) look deliberate, not broken.
2. `/djs` list (`src/pages/DJs.tsx`, `DjTiles`). Stage name on every tile; mark DJs with upcoming gigs (lead role rule); keep the gold/near-black world.
3. `/teachers` list (`src/pages/Teachers.tsx`). Today the flag is closed and shows a "coming soon" form. Option 2: a real list of only teachers who have a teacher page to open (say how many of the 59 qualify; the S8 finding was that most teacher-only people have an EMPTY teacher read). Also show what `/teachers` would be if almost nobody qualifies (the thin-page rule: no "coming soon").
4. Organiser page team strip (`src/pages/OrganiserProfile.tsx`, "Teachers & DJs"). Each member: name by the name rule (DJ name if they appear as a DJ), role label, link to the right role page (never a dead end, never "Teacher not found"). Use a real organiser with a team.
5. Event lineup (`src/modules/event-page/BentoPage.tsx`, `bento/blocks/schedule/PersonChip.tsx`). A real event whose programme has a DJ and a teacher: DJ chip shows the stage name and links to the DJ page; teacher chip shows the real name and links to the teacher page only when that page has content, else no link. Keep the event bento look.

## People and events
Reuse the S8 people where they fit (threerole Bisket / Oreo Sensual, Roger, Enoch, Pierre, Javier). Pick the organiser and the event from prod (read-only SELECTs); say how you picked each. Counts only in docs, no personal data (no phones, no emails).

## Output
- 390x844 full-page screenshots: `docs/mockups/s9/<surface>-today.png` and `docs/mockups/s9/<surface>-opt2.png` for surfaces dancers-list, djs-list, teachers-list (+ `teachers-list-opt2-empty.png`), organiser-team, event-lineup.
- PHOTOS: r2.dev was unreachable from the last two sandboxes. Try it first; if blocked, say so and keep the real fallbacks (never invent photos).
- `docs/handover/s9-mockups.md`: per surface: what changed vs today and why (which owner rule), fixture vs real per line, every place a thin-page rule hid something, every link target (and that none is a dead end), counts that drive the design (dancing-role people in the list, DJs with upcoming gigs, teachers with a non-empty teacher read), open questions for the owner, what is NOT verified. Stop after the push.
