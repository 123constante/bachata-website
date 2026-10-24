# S8 mockups: one page per person vs separate linked role pages (prototype, no PR)

Branch `claude/s8-mockups` (from `claude/s7-mockups`). Route `/__mock/s8/:view/:fixture/:role?`
(view = opt1 | opt2 | search | lineup), only when `DEV || VITE_MOCKS=true`. Code: `src/modules/person-page/mockups/S8Mock.tsx`
(+ `export` added to helpers in `MockPersonPage.tsx`, 2 fixtures in `fixtures.ts`, 2 lines in `AnimatedRoutes.tsx`).
No live page changed. Screenshots (390x844 full page, production build with `VITE_MOCKS=true`): `docs/mockups/s8/`.

## People (real prod rows, read-only SELECTs, counts/ids only)
- `threerole` = Bisket / Oreo Sensual (`04ca2889-...`): S7 pick; Teacher + DJ + Dancer in the roles RPC, stage name differs.
- `roger` = Roger Cracco (`005a7329-...`): DJ with upcoming gigs (2) + dancer; picked in S7.
- `tcher` = Enoch Lopez (`57ef6bdc-...`): teacher-only (only `teaching` in person_roles) AND a working `get_public_teacher_detail_v1` row, thin payload. He HAS a photo on prod.
- `pierre` = Pierre Henry (`0dd8819b-...`): teacher-only, NO photo (first of 40 such rows by id order). FINDING: his teacher read is EMPTY, so is every other no-photo teacher-only person I tested (11) and 20 of 22 teacher-only people overall: only 2 of those I tested have a teacher detail row. Today `/teachers/:id` for them says "Teacher not found". No person is both no-photo and teacher-readable, so Pierre stands for "no photo" and Enoch for "thin teacher page".
- `javier` = Javier (`26ef26e9-...`): dancer-only (only `dancing`), no bio/description, no years/styles/songs/achievements; has a photo.

## Option 1 - one page per person (`opt1-*.png`)
Arrangement: STACKED (not stamps). One shareable page must read top to bottom with nothing behind a tap; stamps hide the other roles until tapped, which is wrong for a page someone shares and a crawler reads. Person card (real name, photo, flag, city, languages, contacts, Share once), then each role as a room in its own look, lead role first (DJ with upcoming gigs, else dancing). DJ room heading carries the stage name ("DJ · Oreo Sensual"); room headings otherwise "Teaches" / "Dances". "Leads: Sample Bachata Nights (sample)" is a FIXTURE (threerole, roger only).

## Option 2 - separate linked role pages (`opt2-<person>-<role>.png`)
Today's three pages, each cleaned, plus an "Also: DJ as Oreo Sensual / Teaches / Dances" bar at the top (44px chips, lists every other role, role is always public). Dancer page = `PublicDancerPageV2` standalone (its own Share shares `/dancers/<id>`); DJ page = the S7 DjBody + a Share button (`/djs/<id>`, title uses the stage name); teacher page = real name heading + Share + the real `TeacherProfile` embedded (it cannot be shown standalone without nesting `GlobalLayout`). Bar links go to the other mock pages.

## Search row and lineup (`search-row.png`, `lineup-entry.png`)
Search: ONE card per person (copy of `ResultCard` markup, not imported: it is private to SearchResults.tsx) with role chips: Teacher / "DJ · Oreo Sensual" / Dancer. Real name leads. Second variant ("typed text matches the DJ name") leads with the stage name and says "DJ name of Bisket". Lineup: DJs by stage name (Oreo Sensual, Roger Cracco has no separate stage name), a teacher by real name (Pierre Henry). Lineup card is NEW markup, not `PersonChip`; sample event, no real event.

## Thin-page rules: where something was hidden
- Dancer room (opt1) hidden when it has no facts/style/stamp/practice/achievements/songs/going: threerole's dancing, javier's, roger's. The Dancer role still appears in search chips and in opt2's link bar, so "role is always public" holds for labels; the empty room itself is dropped. Owner to confirm: should a role with nothing to show still get a room-less page (opt2 shows just the card + "Get your own card")?
- Teacher room hidden when the teacher read is empty (Pierre): no "Teacher not found". Opt2 shows "This teacher has no public teaching profile yet." instead.
- "Dancing N years / Newcomer": `yearsDancing` is null when never answered, so the facts row is already absent (V2 does this itself). "No public contacts yet" line (V2): suppressed with `extrasOk={false}`. DANCER label only appears on the dancer page of someone with the dancer role. Contacts, languages, Share live once on the card (opt1). DJ guestbook "coming soon" stub, empty FAQ/pricing cards: not rendered (S7 DjBody never drew them).
- NOT hideable without editing live pages (so still visible in the mocks): the real `TeacherProfile` draws an empty "Connect / No public contacts" card and "Event appearances / No event appearances yet" (see `opt1-teacher.png`). Fix belongs in `TeacherProfile.tsx`, a live file; I did not touch it.

## Photos
r2.dev (`pub-...r2.dev`) was UNREACHABLE again from this sandbox (every avatar request failed, also through `/_vercel/image`). Screenshots show the real fallbacks (initial disc), not invented photos; in `search-row.png` broken-image alt text shows instead of a disc where a photo URL exists. Photos and the flag badge on photo-less people are NOT verified.

## Reused vs new
Reused unchanged: `PublicDancerPageV2`, `buildPublicDancerPage`, `DjTiles`/`djInkTheme`, `TeacherProfile`, S7 `PersonCard`/`DjBody`/`DancerBody`/`TeacherBody`, `get_public_person_roles_v1`, `get_public_dancer_extras_v1`, `get_public_dj_v1`, `get_public_teacher_detail_v1`, `get_profile_event_timeline_v2`. New: link bar, S8 share button, room headers, search card, lineup lines, the thin-room rules above.
Fixture vs real: everything is real prod data except the organiser line (sample) and the "sample event" lineup frame.

## Not verified
No real phone, no keyboard/screen-reader pass, no CI/tests/lint run (prototype), no PR. One shot per page after data-ready, 390 wide, no horizontal scroll, no page errors. `.env.local` (ignored) held the prod URL/anon key; the shell's own `VITE_SUPABASE_*` pointed at another project and had to be overridden on the build command. `/__mock` is in the production bundle only because of `VITE_MOCKS=true`.
