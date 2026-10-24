# People arc S4 -- the teacher world (design record)

Brief: `briefs/PEOPLE-S4-teacher-world-brief.md` on `brief/people-arc` (sha 794068d0). Approved design:
`claude/people-arc-worlds`, `docs/people-arc/worlds/src/worlds.js` `teacherWorld` + `worlds.html` `.t-*`
(owner D7: KEEP the light lilac "studio timetable" card on a dark violet grid ground).
Behind `flags.personWorlds` (teacher pages also need `flags.teacherDetail`). Flag OFF = today's page.

## What the world shows

1. Frame (shared): Back + Share, role tabs only with 2+ roles (unchanged S1-S3 code).
2. Card: TEACHER band with two punched holes, ruled lilac paper, face 100px (photo or initials, teacher
   colours), name in Fraunces 700 27px (23px over 18 chars) with the flag drawn from `nationality_code`
   (never printed as text), "Teaches in <city>" (London when no city), "Speaks <full language names>".
3. "Next class" / "Next classes" (2+): rows lead with the time (Fraunces 22px), the full-weekday date under
   it, then "class &middot; venue". Day = London wall clock of the stamp (`wallDayOf`), so a 23:30 class
   stays on its day. Midnight on the dot = no time.
4. Nothing coming up: a muted line ("No classes on the calendar yet." / "No classes coming up yet." when only
   past ones), then ONE "Classes this week" button to the classes calendar (`buildCityPath(city, 'classes')`).
5. ONE contact row "Learn with <first name>": website, else Instagram, else Facebook (the old page showed the
   website twice). No phone / email / WhatsApp.
6. D8'' invite "Dance bachata too? Get your own card" for signed-out / anonymous visitors only.
7. Loading (card-shaped pulse in the shell), class read failed ("Couldn't load the classes." + Try again),
   not found ("This teacher profile doesn't exist or has been removed." + Back to Teachers): all actionable.

## Q2 (old detail sections) -- decision taken, needs owner confirmation

The brief left Q2 bracketed. The worker took the thin reading (D3 "thin first", the approved design shows
none of them): on the flag-ON world the old bento sections (experience / years, styles, lessons, FAQ,
journey, achievements, gallery, the socials grid, "Event appearances") are NOT shown; they stay on the
flag-OFF page. Years teaching is therefore hidden (prod has 0 teachers with it filled, so no rule was
needed). If the owner wants any of them back, they are a follow-up.

## Gate 4 self-checks (not a certification: Stage 5 critique is a separate worker)

| Check | Result |
|---|---|
| Contrast, light card | name 15.46 (13.16 on a ruled line), lines 10.30 (8.77 on a rule), band 8.85 |
| Contrast, dark ground | h2 14.21, time 9.52, date 14.35, row small 9.10, empty note 10.81 on the grid, CTA 7.60, contact 9.36 / 16.41, retry 7.16, invite 8.15 |
| Taps | every link/button >= 44px, explicit px (`TAP`); class rows 60px |
| Clipping / sideways scroll | none at 390x844 and 360x800 on 9 prod teachers |
| Page errors | 0 |
| Frame box | Back at L10 T113 and tabs at y=163 on every shape (same as the DJ/dancer worlds) |

The walk's automatic contrast probe reported 1.22 on every name: it reads the ruled-line
`repeating-linear-gradient`'s `transparent` stop as black. The pairs above are computed from the tokens.

## Shapes walked (prod, flag ON, 2026-10-24) -- shots in `docs/people-arc/s4/shots/`

| Shape | Slug | 390 | 360 |
|---|---|---|---|
| 3 upcoming, flag, languages, 3 roles | melita-somos | [390](../people-arc/s4/shots/melita-somos-390.png) | [360](../people-arc/s4/shots/melita-somos-360.png) |
| 3 upcoming, no flag, no languages | nadina-toso | [390](../people-arc/s4/shots/nadina-toso-390.png) | [360](../people-arc/s4/shots/nadina-toso-360.png) |
| 1 upcoming, website, 3 roles | ramiro-zapata | [390](../people-arc/s4/shots/ramiro-zapata-390.png) | [360](../people-arc/s4/shots/ramiro-zapata-360.png) |
| teacher-only, longest name (23), Madrid, no class, no link | llf-malva-marina-montenegro | [390](../people-arc/s4/shots/llf-malva-marina-montenegro-390.png) | [360](../people-arc/s4/shots/llf-malva-marina-montenegro-360.png) |
| past-only | magda-sobolewska | [390](../people-arc/s4/shots/magda-sobolewska-390.png) | [360](../people-arc/s4/shots/magda-sobolewska-360.png) |
| unclaimed, Instagram only, 1 upcoming | unclaimed-645cb1ef | [390](../people-arc/s4/shots/unclaimed-645cb1ef-390.png) | [360](../people-arc/s4/shots/unclaimed-645cb1ef-360.png) |
| no class, no link | viola-palmai | [390](../people-arc/s4/shots/viola-palmai-390.png) | [360](../people-arc/s4/shots/viola-palmai-360.png) |
| languages, no flag, no class | nico | [390](../people-arc/s4/shots/nico-390.png) | [360](../people-arc/s4/shots/nico-360.png) |
| teacher-only, Madrid congress teacher | llf-enoch-lopez | [390](../people-arc/s4/shots/llf-enoch-lopez-390.png) | [360](../people-arc/s4/shots/llf-enoch-lopez-360.png) |
