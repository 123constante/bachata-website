# S9 mockups: the remaining people surfaces in the Option 2 world (prototype, no PR)

Branch `claude/s9-mockups` (from `claude/s8-mockups`). Route `/__mock/s9/:view` (view = dancers | djs | teachers | teachers-empty | organiser | lineup), only when `DEV || VITE_MOCKS=true`. Code: `src/modules/person-page/mockups/S9Mock.tsx` + 2 lines in `AnimatedRoutes.tsx`. No live page changed.
Screenshots: `docs/mockups/s9/<surface>-today.png` (the real live component) and `<surface>-opt2.png` (mock), 390x844 full page, PRODUCTION build against the prod project, read-only reads with the public anon key. Today shots were built with `VITE_ENABLE_ORGANISER_DETAIL=true` (organiser page) and every other flag at its default (so `/teachers` today is the closed "Coming soon" page, and teacher detail is off).

## Counts that drive the design (prod, read-only, counts only)
- Active people 164. With the dancing role: **92** (72 are not dancers: teacher-only, DJ-only, no role).
- DJs 40; **17 have an upcoming gig** (timeline RPC the DJ page uses); 35 of the 40 also hold the dancing role; 26 also teach; 11 have a stage name that differs from the first name.
- Teachers listed by `get_public_teachers_list_v1`: **59**. All 59 have a non-empty `get_public_teacher_detail_v1` read (the list RPC already requires photo + city + name, which is exactly what the detail read requires). So the S8 finding ("most teacher-only people have an EMPTY teacher read") is about the other ~66 of the 125 people with the teaching role, who are not in the list at all. Of the 59: 57 also dance, 25 also DJ, so only 2 are teacher-only.
- Photos: r2.dev was UNREACHABLE again (proxy refuses it). Every photo in every shot is the initials fallback; no photo invented. I made the mock's fallback a deliberate initials disc that also appears when a photo URL fails to load (the live pages show broken-image alt text in that case, see the today shots).

## People and events (how picked)
- Organiser: `unidos-flow` (`5eb4681d-...`). Read-only SELECT of organisers with active team members: 8 have one; picked the first non-test organiser with 2 members who are both DJ and teacher. Test organisers (`zz-test-invite`) skipped.
- Event: series `34156f15-...` (live). Of 14 live events that have a DJ slot and a teacher slot, **13 return nothing to an anonymous viewer** (`event_view_p5` = null; 404 on the live site); this is the only one whose programme an anonymous viewer can read. Programme: DJ "Morcilla" + teacher "Ronald & Alba". I could not use the S8 people (Bisket/Oreo Sensual's event is not publicly readable).

## Per surface
1. **/dancers** (`dancers-list-*`). Today: all 164 active people incl. teacher-only and DJs; the hero widgets show literal `??` / `?` characters (existing mojibake, three widgets), test-style names appear as tiles. Opt 2: only the 92 with the dancing role; count line says how many are hidden; small role labels "DJ" / "Teaches" where the person also DJs / has a teacher page. Thin tiles (no photo): initials disc, same size as photo tiles. Rule: dancer list = dancing role (Option 2), thin-page rule. Real: all data. Fixture: none. NOT changed: the hero widgets (not part of the mock; flagged only).
2. **/djs** (`djs-list-*`). Today: plain tiles, name via `renderPublicName` (stage name already first), no gig info. Opt 2: gold/near-black world (`djInkTheme`), 40 DJs, the 17 with upcoming gigs first with a gold border and "Playing soon" (lead-role rule), stage name on every tile. Real: all data.
3. **/teachers** (`teachers-list-*`). Today: flag closed, "Coming soon / drop your event details" form. Opt 2: real list of the **59** teachers who have a page to open (real name, city, first style); `teachers-list-opt2-empty.png` shows the page if nobody qualifies: no "Coming soon", one line that says no teacher has a public page yet and a "Browse classes" button to `/classes`. The empty state is simulated by filtering the real list to zero (nothing is invented). Open: the Teachers directory flag and teacher-detail flag must both be on for any of this to be real.
4. **Organiser team strip** (`organiser-team-*`). Today: circle per member linking to `/dancers/<id>` regardless of role, role text = the team row's own role. Opt 2: name by the name rule (stage name when the member is a DJ with a DJ read: "DJ El Rugido"), role labels from what the person really is (DJ / Teacher, teacher only when the teacher read is non-empty), link: DJ page, else teacher page (only with content), else dancer page (only if dancing role), else no link. Both members are DJ + teacher, so both link to `/djs/<id>` (lead role = DJ). Only the strip is mocked, not the whole organiser page. Note: the DJ name "DJ El Rugido" already starts with "DJ", so the "DJ" label repeats it; owner to decide whether to drop the label then.
5. **Event lineup** (`event-lineup-*`). Today: real event page. Opt 2: the real `PersonChip` fed by a mock `Person`: DJ chip = stage name (Morcilla) linking to `/djs/<id>`; teacher chip = real name (Ronald & Alba) linking to `/teachers/<id>` because its teacher read is non-empty; a teacher whose read is empty would get `href: null` (the chip's own "no profile yet" dim state, no link). Only the lineup block is mocked, not the whole bento. Neither person in this event differs in a way that tests the rule beyond the DJ chip, since I could only use one public event.

## Thin-page rules that hid something
Dancers list: 72 non-dancing people dropped. Teachers list: ~66 teaching-role people were never listed (no photo/city); empty-state text replaces "Coming soon". Organiser strip: "Teacher" label and teacher link only with a non-empty teacher read. Lineup: no link without a page. Role labels: only roles the person holds.

## Link targets (none is a dead end in the data)
Dancer tile -> `/dancers/<id>` (a dancing-role person). DJ tile -> `/djs/<id>` (in `list_public_djs_v1`). Teacher tile -> `/teachers/<id>` (non-empty read). Organiser strip and lineup as above. CAVEAT: the live `/teachers/<id>` shows "Coming soon" while `teacherDetail` is off, and `/teachers` while `teachersDirectory` is off, so those links are dead ends until the flags are on. I did not click every link.

## Open questions for the owner
1. Turn on the teacher flags before Option 2 ships? (without it, every teacher link and the whole list are a coming-soon page.)
2. Teacher list qualifies by the existing photo + city rule: 66 teaching-role people are invisible. Accept, or relax the read?
3. Show a "Playing soon" mark on DJ tiles (lead-role rule) or only sort?
4. "DJ" label next to a stage name that already starts with "DJ".
5. `/teachers/:id` still returns phone/email without a toggle check (inventory problem 6); not touched here.

## Not verified
No real phone, no screen reader/keyboard pass, no tests/lint/CI (prototype), no PR. Today shots: the `/dancers`, `/djs`, `/teachers` live pages were captured once after load; I did not read them pixel by pixel. Photos and flag badges on photo-having people are not verified (r2.dev blocked). Real-data shapes are covered only for the 3 list pages and one organiser/one event. The build's shell `VITE_SUPABASE_*` pointed at another project; it was overridden on the build command (and `.env.local`, git-ignored, holds the prod URL and public anon key).
