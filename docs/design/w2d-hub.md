# Design record: W2-D person hub redesign, mockups (Design Gate stages 1-2)

Ticket dt_2790581403f1. Brief: `brief/w2d-hub-mock:briefs/W2D-hub-mock-brief.md`. Mockups only: no change to `src/`.
Files: `docs/mockups/w2d-hub/` (`a.html`, `b.html`, `c.html`, `tap.html`; open one and add `#s1`..`#s4` to switch the
data shape). Pictures and numbers are made by `build.mjs` then `shot.mjs` (numbers in `report.json`).

## Brief (five lines)
- **Who:** a dancer looking for partners, or someone booking a DJ or teacher (equal weight), on a phone (390x844).
- **Arrives from:** a wall tile (or an old `/people/:id` link) for a person with TWO or more roles that have a page.
- **One job:** see who this is, then open the role page they came for, starting with the person's strongest role.
- **Feel:** a neutral warm dark brown frame (`WALL.page`), accent from the main role (dancer teal, DJ gold).
- **Rules:** fills the screen, soft fade into the orange footer (no hard seam), taps >= 44px, text >= 4.5:1, says what each control does.

## One-role people skip the hub (owner decision; behaviour in words, frame `tap.png`)
- Count the person's VISIBLE roles (roles that have a public page today; teacher is not one while teacher pages are closed).
- Exactly one: the wall tile links straight to that role page, and `/people/:id` forwards there too (a replace redirect, so
  Back does not bounce through the hub). Old shared links keep working.
- Two or more: the hub below, led by the main role (the existing `linkRoleFor` rule: DJ leads when they have a gig coming up).
- Zero: today's 404, unchanged.
- **Owner call:** by this rule the 36 dancer + teacher people (shape 3) SKIP the hub while teacher pages are closed: they have
  one role with a page. Shape 3 is mocked as the brief asks, for when teacher pages open, or if you want held roles (chips) to
  count instead. Recommend: count visible roles (one tap fewer for 36 people; the dancer page already shows their chips).

## The three options (all share header, tokens, Back, chips, the fade and the footer)
| | A: stacked role cards, big photo | B: role switcher (tabs) | C: one hero role card + "Also" |
|---|---|---|---|
| Structure | 264px photo card, name, chips, facts, then one card per role (main role first), each with its summary and "Open" | 88px face + name, a segmented row of role tabs, ONE panel with the active role's facts and a big "Open ... page" button | A large card for the main role (face, name, chips, its summary, big "Open ... page" button), then smaller "Also" tiles, then About |
| Gains | Every role and its summary visible at once; nothing hidden; the photo does the "who is this" job best | Shortest page; the button is always in the same place; reads like an app | The strongest role is unmistakable (owner: lead with it); one obvious first tap; other roles one tap away and still visible |
| Costs | Longest page: three roles push the fade below the first screen (`a-s4`); the photo is a placeholder (real photo quality varies; 0 of 10 dancer + DJ people lack a dancer photo, but DJ-lead faces use the DJ photo) | Other roles are hidden behind a tap; two taps to reach a non-main role; the tab row repeats the role switch bar the role pages already have | Main role gets most of the screen, so a booker who wants the "other" role reads past the hero first |
| Closed teacher | Dashed card, not a link, says "No teacher page yet: teacher pages are not open" | Tab shows "opens soon", `aria-disabled`, does nothing | Dashed Also tile, not a link, "Teacher pages open soon" |
| Fills 390x844 | yes (content to y 695-814, fade, footer) | yes (content to 606, then fade and footer on screen) | yes (content to ~697, fade, footer) |

**Recommendation: C.** It does the owner's "lead with the strongest role" literally, gives one obvious first tap for both
audiences (the main role's page), and still shows the other roles without a hidden tab. It is the same height for 2 and 3
roles (Also tiles sit side by side), so the page never grows past the first screen and the fade always shows. A is the safe
second (most information); B is weakest (hides roles, adds a tap, duplicates the role pages' switch bar).

## Tokens (no new colours)
`WALL.page #1E1410` (frame, header in the mock), `WALL.card #2B1D16`, `WALL.text #FBEBDD`, `WALL.muted #CDB09C`, `WALL.line #6A4A38`,
`CHIP[role]`, `TILE[role]` from `src/modules/person-page/wall/tokens.ts`; footer `#FFA600` = `bg-primary` (`--primary: 39 100% 50%`).
Accent = `CHIP[lead]` (button, accent bar) and `TILE[lead].edge` (hero/panel outline).

## Measured (390x844, DPR 2, `shot.mjs`, all 12 views + `tap`)
| Check | A (s1/s2/s3/s4) | B | C | Rule |
|---|---|---|---|---|
| Lowest text contrast | 7.70 / 7.43 / 7.60 / 7.60 | same | same | >= 4.5 |
| Where | chip text on chip (Dancer `#04302C` on `#2DD4BF` 7.70, Teacher 7.60), initials `#A7F3E8` on `#0F4F4A` 7.43 | | | |
| Other pairs | muted on card 7.97, muted on frame 8.85, text on card 13.98, gold on card 8.92, teal on card 8.74, footer black on `#FFA600` 10.71, DJ initials `#FFE3A0` on `#6B4A0E` 6.41 (tap frame) | | | |
| Text on a gradient | 0 elements | 0 | 0 | none |
| Smallest tap box | 44x44 (site Menu); Back 44 tall; role cards 88 tall; CTA 52; tabs 48; Also tiles >= 72 | | | >= 44 |
| scrollWidth | 390 | 390 | 390 | = viewport |
| Seam step (x = 4 px column, under the header to the page end, per CSS row, max channel 0-255) | 3 | 3 | 3 | < 6 (the #924 gate) |
| Empty dark gap above the fade | 20px (padding) | 20px | 20px | no big gap |

The fade: 96px `#1E1410 -> #FFA600` straight into the footer; the largest one-row step is 3 (the rows are about 2.3 apart in red).
Before (owner's report): the hub ground ended in the cool site ground and met the footer as a hard edge (#924 measured the
footer edge at step 241).

## Building it later (words only, not in this branch)
- The real footer has `mt-16`: that 64px strip shows the page ground, which is why the owner saw a cool band. The hub page
  must stand on the `wall` ground AND the fade must cover the strip (e.g. the hub drops the gap or paints the fade into it).
  It is a site-wide footer, so do it for the hub route only.
- The redirect needs the visible-role count in the loader (it already has `roles`).

## Not verified
- Real photos (placeholders drawn; a real photo under option A's name needs its scrim checked per photo).
- The real site header (mocked as a plain bar on the frame colour; the real one has a gold rule, site chrome).
- 360 and 430 widths; a real phone.
- Prod survey: roles from `get_public_person_roles_v1` over all `dancer_profiles` rows (held roles, counts only): teacher 62,
  dancer + teacher 36, dancer 26, dancer + DJ + teacher 25, none 22, dancer + DJ 10, DJ 4, DJ + teacher 1. Not filtered to
  active rows (the `is_active` filter with `person_entity_id` returned no roles; not chased). Gig counts were not surveyed.
