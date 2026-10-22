# Handover: W2-C role pages, mockups only (Design Gate stage 2)

Ticket dt_20f3f6042b61. Branch `claude/w2c-mock` off `main` at 3a21361 (#947 merged). Brief: `brief/w2c-role-pages:docs/briefs/W2C-mock-brief.md`.

**Nothing in the app changed.** The mockups are one static page with mock data, outside `src/`:

- `docs/mockups/w2c/index.html` &mdash; open it with no query for the labelled gallery of every view
  (each phone 390 wide, scroll inside it); `index.html?view=<id>` shows one screen.
- `docs/mockups/w2c/<id>.png` &mdash; full-page picture of each view at 390x844, DPR 1.
- `docs/mockups/w2c/shot.mjs` &mdash; retakes the pictures and the checks: `node docs/mockups/w2c/shot.mjs`
  (writes `report.json`).

Colours are copied from `src/modules/person-page/wall/tokens.ts` (WALL warm dark base `#1E1410`, card `#2B1D16`,
CHIP / TILE role accents, the same 64 px soft fade at top and bottom), so the role pages sit on the hub's base.
Teacher pages are closed (`flags.teacherDetail` OFF), so a teacher role never gets a switcher tab
(`N-*-three` shows 2 tabs; `N-A-three-open` shows what 3 tabs look like once that flag flips).

## D &mdash; DJ page (owner: gigs first, then bio, photos; fix the clipped vinyl name)

Every D view uses the N-A bar on top. Fixtures: `roger` (6 upcoming gigs, photo), `quiet` (no gigs, no photo),
`long` ("DJ Carlos De La Cruz Fernandez-Montenegro", 2 gigs, 3 roles).

| Option | What it is |
|---|---|
| **D-A Vinyl strip** | A compact card: the turntable at 104 px on the left, name (serif) wrapping on the right with real name, DJ chip and city. "Upcoming dates" list straight under it (next date has the gold edge), max 3 + "See N more dates", then About, Photos, Listen &amp; book. |
| D-B Next-gig button | The hub's header card (rounded-square face, sans name) with the next date as the big gold button inside it; the rest of the dates under "Also coming up". |
| D-C Vinyl kept, centred | Today's hero, smaller (152 px turntable), with "DJ &middot; LONDON" and the name under it at full width; dates under the hero. |

The clip fix (all three): the name wraps (`overflow-wrap: anywhere`) and its size steps down by length
(36 / 30 / 26 px in C) instead of today's fixed `text-5xl` with `leading-[0.92]` inside an `overflow: hidden` hero.
Long name: 2 lines in A and C, 3 in B; nothing clipped (`report.json`: `clipped: []`).

No gigs (`*-quiet`): one card "No dates booked right now. / Follow on Instagram to hear about the next one." with an
"Open Instagram" button (the empty state says what the visitor can do; in the build it must only show when the DJ has an
Instagram link, else drop the button).

**Pick: D-A.** The first date is at y about 370 on a 844 screen (gigs really are first, under the name); the vinyl stays
as the DJ page's signature without eating the first screen (C pushes the first date to y about 540); it is the most
compact (density rule). B's gold button is strong but repeats the hub's next-event button word for word, so the visitor
sees the same button twice in two taps.

## N &mdash; Back bar + role switcher (owner: replaces the "Also:" row; only with `flags.personHub` ON)

Fixtures: `two` (DJ + Dancer), `three` (Teacher + DJ + Dancer, teacher closed = 2 tabs), `one` (Dancer only = no switcher).

| Option | What it is |
|---|---|
| **N-A Segmented pills** | "&larr; Back to hub" (44 px) on its own row, then a full-width pill bar with one segment per role page; the current one is filled in its role colour, the others show a role-colour dot. |
| N-B Underline tabs | Same back row, then full-width text tabs with a 4 px underline in the current role's colour. |
| N-C One row | Back on the left ("Back to <name>", wording alternative), role chips on the right of the same row. Shortest, but a long name ellipsises and three chips would not fit at 390. |

1 role: only the back row, no switcher (all three).

**Pick: N-A.** The current page reads at a glance (filled pill in the role colour, which is the same colour as the
role's chip on the wall and hub), every segment is at least 44 px tall and about 180 px wide, and it still fits 3 roles.
N-B's inactive tabs are just muted text and read less like buttons to a newcomer.

Wording: A and B say "Back to hub" as the owner wrote it. C tries "Back to <name>" so the owner can compare; a newcomer
may not know the word "hub". Owner call.

## P &mdash; Dancer page before / after (owner: separate dancer-area PR, owner sees before/after first)

| View | What it is |
|---|---|
| `P-before` | Today: the "Also" chip row ("DJ Roger &nearr;") on the site ground, then the teal `PublicDancerPageV2` block with its own Back (to /dancers) and Share. |
| `P-after-A` | Minimal: Back to hub + N-A switcher on the warm base, today's teal block under it (its own Back removed, Share kept). |
| **`P-after-B`** | Warm: no teal page block. The teal hero card stays (the dancer's accent), Going next / Connect / Highlights become warm cards with teal labels and edges; Share moves into the Connect row. |
| `P-after-C` | As A with the N-B underline tabs. |

**Pick: P-after-B.** A and C put a dark-teal block on the warm brown base: that is a hard colour seam between page
surfaces (seen in the pictures; the brief asks for none). B keeps the dancer identity (teal) as an accent, the same
way the hub uses role accents on one warm base.

## Checks at 390x844 (`report.json`)

| Check | Result |
|---|---|
| Tap targets under 44 px (every link / button / `data-tap`, site chrome excluded) | 0 in all 23 views |
| Clipped text (overflow hidden with content wider than the box) | none |
| `scrollWidth` | 390 everywhere |
| h1 per page | 1 |
| Seam: largest one-row colour step in the column at x = 6 between site header and footer | 1 (0 in P-before) |
| Min text contrast, D and N views on the warm base | 6.41 (the "N" initials, gold tile ink on the DJ tile) to 7.97 |
| Min text contrast in views with today's teal hero | **3.66**, see below |

The 3.66 is today's `PublicDancerPageV2` fact label colour (`#BFE9EE` "DANCING / LEVEL / STYLE") measured against the
**lightest** stop of the teal hero gradient (`#1C7D93`, the checker takes the first stop); where the labels actually
sit (lower part of the hero) the gradient is darker, so the true figure is higher. It is the current page's colour,
unchanged by these mocks, but the dancer-area PR should measure it from pixels and darken the hero top or lighten the
label if it is under 4.5.

## What I looked at in the pictures

- Warm base runs from under the site header's gold rule to above the orange footer with no line (the gold rule and the
  footer are site chrome on every page).
- D-A/D-C long name: 2 clean lines, no clipping; D-B: 3 lines next to the face, fine.
- Gig rows: the non-next rows are padded so their dates line up with the next row's (fixed after the first pass).
- N-C three: "Back to Marta Silva" plus two chips just fits; a longer name ellipsises (C's weakness).
- P-after-A: the teal block on brown is the seam that led to P-after-B.

## Verified / Not verified

- Verified: every view renders, the checks above, the pictures looked at one by one (D-A-roger, D-A-long, D-B-long,
  D-C-long, N-C-three, P-before, P-after-A, P-after-B).
- Not verified: real prod data shapes (mockups only; the Supabase connector was not authorised in this session, so no
  shape survey was run). Fonts: the DJ serif falls back to Georgia here (no network for Google Fonts), so the real DM
  Serif Display will set slightly differently. No app build, no Vercel preview of the mocks (the page is not in the app).
- Local lint chain: 19 of 20 links PASS; `check:integrity` exit 126 because `bin/check-integrity.sh` is not executable
  in this checkout (mode, not content); `bash bin/check-integrity.sh` = ok, 0 issues. `AUDIT_STRICT=1 check:images` ok.

## Next steps (for the build PRs, after the owner picks)

1. DJ page (D pick) + N bar on `/djs/:id`, both behind `flags.personHub`; flag OFF = today's page and Also row.
2. Dancer page (P pick) in its own dancer-area PR.
3. Switcher data: the visible roles (`derivePersonRoles`), one tab per role whose page exists; "Back to hub" goes to
   `/people/:id`.
