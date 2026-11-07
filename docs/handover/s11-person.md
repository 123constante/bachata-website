# S11 person page: role badges in the S9 family look (prototype, no PR)

Branch `claude/s11-person` (from `claude/s9-facewall`). Route `/__mock/s11/:view` (`dj | teacher | three | nophoto | card | sheet`), `?theme=dark`.
Code: `src/modules/person-page/mockups/S11Person.tsx` + 2 lines in `AnimatedRoutes.tsx`. `S9FaceWall.tsx` untouched (tokens copied). No production component or route changed.
Images (390x844 @2x, `VITE_MOCKS=true` production build, real prod reads SELECT-only) in `docs/mockups/s11-person/`:
`{dj,teacher,three,nophoto}-{light,dark}.png` (cream / warm dark), `sheet-cream.png`, `sheet-dark.png` (4 labelled frames side by side), `card-dj-{light,dark}.png` (calling-card preview), `contrast.json`.

## What was built
One arrangement: role badges on a single page. Top card: face (photo, else initials tile in the lead role colour), name, role badges (lead badge has a thicker edge), one plain line,
"Leads: <organiser>" line, ONE primary button "Go to their next event . <date>" (hidden when no upcoming event), Share once. Then the lead role's section, other sections only when filled.
- Lead rule: DJ with upcoming gigs leads (gigs section first, stage name leads when one exists), else Dancing leads. Teacher is a badge only (no section).
- Frames: Roger Cracco (DJ + Dancer + Organiser, gigs), Gatica (Dancer + Teacher, Dancing leads), Bisket / Oreo Sensual (DJ, Dancer, Teacher, Organiser; leads with gigs, stage name headline, real name under), Pierre Henry (no photo, teacher only: initials tile, badge, one line, Share; nothing else).
- Calling card: a chat bubble with the link preview (face, name, badges, line, "Next: Thu 22").
- Contrast (`contrast.json`): all text pairs >= 5.47 (need 4.5); chip edge vs card >= 5.04 (need 3). Gold chip edge is a darker gold on cream and the normal gold on dark so the edge stays above 3 (S9 had this at 1.68).

## Owner should look at
1. Lead badge has a thicker edge and the button takes the lead role colour (gold for DJ, teal for Dancer, violet for Teacher). Does that tell "main role" clearly enough?
2. Pierre Henry's page is almost empty (card only). Is a bare card OK, or do you want a line such as "Teaches in ..." added?
3. Share goes to a calling-card preview; the card shows the next date. Is the date on the shared card wanted?

## Not verified
- PHOTOS: media.bachatacalendar.co.uk is 403 from the sandbox, so a person with a photo shows a labelled dashed PHOTO block (not an invented face). Real crops are NOT verified.
- "Leads: Sample Bachata Nights" is a FIXTURE (organiser read may not be on prod); Roger and Bisket marked organiser by hand.
- Teacher badge for Gatica / Bisket / Pierre is hand-set (teacher pages are closed on prod).
- Share button only opens the preview frame; real share/copy and the og:image card are not built. Dancer data is thin for these people (Gatica shows style chips only; no favourite songs on these four).
- Not run: tests, lint, CI, real phone. `VITE_MOCKS=true npm run build` passes (prod URL/anon key passed as env at build, not committed).
