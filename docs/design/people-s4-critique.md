# People arc S4 -- the teacher world (#999): independent critique (Design Gate stage 5)

Brief: `briefs/PEOPLE-S4-critique-brief.md` on `brief/people-arc` (sha cf7189d9). Critic: a fresh worker, not the
builder. Judged on 2026-10-24 against a production build with `VITE_ENABLE_PERSON_WORLDS=true` and
`VITE_ENABLE_TEACHER_DETAIL=true` on prod data (read-only anon reads), Chromium at 390x844, 360x800 and 430x932,
compared with the approved mock (`claude/people-arc-worlds`, `docs/people-arc/worlds/shots/ramiro-teacher-390.png`,
`src/worlds.js` `teacherWorld`).

Visitor: a London dancer on a phone, opening a teacher's page from a shared link or the teachers wall, wanting to see
who they teach as and when their next class is.

## Ordered fix list

| # | Finding | Why it matters to the visitor | Severity | Verdict |
|---|---|---|---|---|
| 1 | **The page jumped 0.46-0.55 (layout shift) while it loaded.** The teacher read is not dehydrated by the loader, so the server HTML is the loading state: two boxes (a 44 px bar and a 168 px card) where the page becomes ~700 px. Measured sources: `FOOTER 0->403` (0.307), `FOOTER 403->645` (0.15), then the invite `527->756` when the classes arrived (the contact row only appeared then, 58 px above it). | Everything below the card moves 2-3 times in the first 2 s; a thumb aimed at the invite or the contact row lands on something else. About ten times the DJ page's shift (0.054). | blocker | **fixed here** (no new read): the loading page now holds the room of the page it turns into, box for box (frame bar, tabs row, card, one class, the contact row, the invite for a signed-out visitor), from shared constants (`TEACHER_ROOM`, `TABS_HEIGHT`); the contact row shows while the classes load (it comes from the teacher row). The card's top padding was `pt-4` (rem: 13.5 px on phones), now `14px`, so the skeleton matches it exactly. After, at 390: 0.034 (1 class), 0.057-0.09 (past-only, 3 classes, detail), 0.074 (no class), 0.131 (teacher-only: the held tabs row closes, the S3 trade-off). DJ page 0.054, dancer page 0.074 on the same build. |
| 2 | **No city printed "Teaches in London".** Owner rule: no city = NO "Teaches in" line. | A teacher based in Madrid with no city stored would be advertised as teaching in London. 0 on prod today (the RPC requires a city), but the owner is relaxing that gate. | should | **fixed here**: the line is dropped; `DEFAULT_CITY` is gone. |
| 3 | **The extra detail (years teaching, styles, private lessons) was not shown at all** (the builder's Q2 reading). Owner rule: only when filled, under the classes. | The 6 teachers who filled styles (and 1 private lessons, 1 years) see their answers vanish; a visitor looking for a Zouk teacher or private lessons cannot tell. | should | **fixed here**: one detail box under the classes / the empty line, above the contact row, one row per filled fact ("Teaching for 3 years", "Styles: Zouk, Brazilian Zouk", "Private lessons: Offered"). Nothing filled = no box (56 of 59 rendering teachers). Same tokens as the contact row (label 9.36, value 16.41). Read from the row the page already fetches. |
| 4 | **No first name: the contact row said "Learn with Teacher".** The h1 falls back to "Teacher" (the shared D5 rule), and the label took its first word. | Reads like a template bug on exactly the pages the relaxed gate will add (11 + 7 + 17 teachers with no first name). | should | **fixed here**: the label uses the first name, else the first word of the resolved name (surname only -> "Learn with Ruiz"), else "Learn more". The h1 is never empty ("Teacher"), tested. |
| 5 | **The timetable grid stopped in a hard line 54 px above the footer.** The grid is drawn on the page box; the layout's plain violet runs on under it. | A ruled edge across the screen above the footer looks like a rendering fault, on every page, in the first screen on thin pages. | should | **fixed here**: the grid fades into the plain ground over the box's last 48 px (a sized gradient layer, no new first-load bytes). Looked at on every shot: no edge. |
| 6 | Raw U+00B7 (middle dot) in `TeacherWorld.tsx` (the class row's "name, dot, venue"). | CLAUDE.md: raw Unicode punctuation turns into mojibake through the Windows mount. | should | **fixed here**: `\u00B7`. |
| 7 | The Georgia flag renders as a grey "GE" sticker (no flag art for that code). | Close to "a code as text"; one teacher on prod (unclaimed-645cb1ef). | nice | **owner call** (the shared `NationalityFlag` art set, every world). Recommendation: add art for the missing codes in a separate PR. |
| 8 | "Classes this week" goes to the visitor's city classes calendar (London), also for a Madrid teacher (llf-*). | The button offers London classes under a Madrid card. | nice | **owner call** (D3 / the mock's copy and link). Recommendation: keep; the label does not say where, and London is the site's city. |
| 9 | Past-only teachers get "No classes coming up yet." instead of D11's "No classes on the calendar yet." | Two wordings for nothing-to-show. | nice | **owner call**: the variant is more accurate (their past classes were on the calendar). Recommendation: keep the variant (S3 critique recommended the same split for DJs). |
| 10 | Teacher-only people (2 render on prod; up to 62 after the gate is relaxed) see the held tabs row close, 58 px up, when the roles read answers (0.057). | A small jump on the thinnest pages. | nice | **not fixed** (the S3 trade-off: holding the row is right for the 57 of 59 who hold 2+ roles). |
| 11 | The frame boxes measure Back L10 T113 63x44, Share L310 T113 70x44, tabs T163 H52, bar W370 at 390 -- the brief quoted L10 T113 60x44 / L298 67x44 / T166 H44 / W354. | Tabs in the same place on every world. | -- | **not a bug**: the brief's numbers came from a different viewport / measure; what matters is that the teacher, DJ and dancer worlds are identical, and they are, to the pixel, at 360, 390 and 430. |
| 12 | Footer `0->714` layout-shift entry on the first paint. | -- | -- | **not this PR**: the same entry is on the DJ (`0->806`) and dancer pages; it is the site's footer, not the world. |

## Checks that passed (no change needed)

- **Identical frame**: Back, Share, the bar and the tabs row are the same boxes on `/teachers/*`, `/djs/papacito` and
  `/dancers/ramiro-zapata` (390: Back L10 T113 63x44, Share L310 T113 70x44, tabs L10 T163 370x52; 360: Share L280,
  tabs 340 wide; 430: Share L350, tabs 410 wide). Unit side: `the one world shell` (teacher matrix) and
  `worldShellGuard.test.ts` both list the teacher world. **Mutation**: wrapping the teacher's PersonFrame in a
  `px-1 pt-1` div turns `worldShellGuard` red; giving the teacher page box an extra `pl-4` turns the shell test red.
- **Back (D9)**, real browser: fresh tab -> Back href `/teachers`; teacher -> Dancer tab -> Back returns to the teacher
  page. Label "Back".
- **Taps**: every link and button >= 44 px in explicit px (`TAP`, `TEACHER_ROOM.contact` 56, class rows 60), every
  shape, 360 / 390 / 430. No clipping, no sideways scroll at 360. 0 page errors over 11 teachers x 2 widths.
- **Contrast** (from the tokens; the walk's automatic probe misreads the ruled gradient): light card -- name 15.46
  (13.16 on a rule), lines 10.30 (8.77 on a rule), band 8.85, initials 9.08; dark ground -- Back/Share 15.65 (14.48 on
  a grid line), h2 14.21, time 9.52, date 14.35, row small 9.10, empty note 11.68 (10.81 on a grid line), CTA 7.60,
  detail/contact label 9.36, value 16.41, retry 7.16. Lowest: 7.16.
- **Focus ring**: 2 px solid #FBEBDD (15.82 on the ground, 14.09 on a section), seen on Back and the class rows by keyboard.
- **Seams**: header (black, gold rule) -> violet grid: clean, as in the mock. Light card on the dark grid: reads as a
  card (shadow, punched holes show the ground). Sections (#211A3D) on the ground: a quiet step, as in the mock. Page ->
  footer: violet to the site's amber, the same hard edge as every page and the mock; now no grid edge above it.
- **Hierarchy**: the eye lands on the name (Fraunces 27 px, 23 px over 18 chars; the 23-char name wraps to 2 lines
  with no clipping), then the class time (Fraunces 22 px), then the date. As in the mock.
- **Copy**: "Back", "Share", "Next class" / "Next classes" (from 2), full weekday names ("Thursday 29 October"),
  languages as full names, the flag never as text in the card, "Dance bachata too? Get your own card" for signed-out
  visitors only (44 px). Nothing points at a control that is not on screen (tested).
- **Class abroad** (Madrid/Barcelona): matrix-tested only (no prod teacher has one upcoming today). Wording: the row
  reads "Class" when the name is blank and drops the dot and venue when there is none; the date is the London wall-clock day
  of the stored stamp. Fine for a visitor in London; a "Madrid" hint would be new content (not added).
- **Flag OFF**: `/teachers/:id` unchanged -- the flag-OFF matrix test (old hero subtitle, AlsoRoles, no world), and
  every line this pass changed in `TeacherProfile.tsx` is inside the flag-ON branch.

## Probe

`docs/people-arc/s4/critique-probe.mjs` (layout-shift entries with their sources, the frame boxes on all three worlds,
the world's blocks, page bottom vs footer, sideways scroll, small taps). Copy under `node_modules/.cache/` and run it
against the served flag-ON build (see the handover for the build line).
