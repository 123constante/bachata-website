# W2-C build, slice 1 &mdash; Design Gate (Back row + role switcher + DJ page)

Ticket dt_9d0660a4fbb9. Owner decisions 2026-10-22: DJ page = **D-C "Vinyl kept, centred"**, navigation =
**N-A segmented pills** with "Back to &lt;name&gt;", dancer page unchanged under the warm bar with a **soft fade**.
All behind `flags.personHub` (default OFF). Mockups: `claude/w2c-mock:docs/mockups/w2c/`.

## What renders (flag ON)

| Surface | What |
|---|---|
| Back row | "&larr; Back to &lt;person's name&gt;" to `/people/<slug or id>`, 44 px, one line, long name ellipsises. "Back to profile" when no name resolves. Shown only when the hub exists (person read has a visible role), never a link into a 404. |
| Role pills | Full-width bar, one segment per role whose page EXISTS (`roleTagsFor` href non-null: teacher stays out while `flags.teacherDetail` is OFF). Current = filled in `CHIP[role]`, others = `CHIP[role]` dot. 1 role page = no pills. Each segment &ge; 44 px. |
| DJ page | Warm hub ground (`WALL_FADE`). Hero card with the 152 px turntable (same `DjTurntable` as today's 188 px hero), "DJ &middot; CITY", the name wrapping at 36/30/26 px by length, no overflow clip. Then Upcoming dates (max 3 + "See N more dates"; placeholder while loading, "could not load" on error), About, Photos (3-column, all), Listen &amp; book, Pricing, FAQ, Share. Times as stored (naive). |
| No dates | "No dates booked right now." + with Instagram: "Follow on Instagram&hellip;" / **Open Instagram**; without: "Check back soon, or find a party on the calendar tonight." / **See the calendar** (`/`). |
| Dancer page | Unchanged (no dancer file touched). The bar mounts through `AlsoRoles` (the existing shared slot) bled to the page edge, with a 12 px fade in at the top and a 24 px fade out at the bottom onto the teal ground. |

Flag OFF: `DJProfile` returns the exact JSX it returned before; `AlsoRoles` renders the old Also row
(`AlsoRolesRow`, body unchanged). `DjHero` renders the same DOM (turntable extracted as `DjTurntable`, size 188).

## Numbers (390x844, html font-size 13.5 px, `report.json`)

| View | min contrast | taps &lt; 44 | scrollWidth | h1 (lines) | largest seam step (x=6) |
|---|---|---|---|---|---|
| dj-roger (2 roles, 6 dates) | 7.97 | 0 | 390 | 1 (1) | 3 |
| dj-one (1 role, no pills) | 7.97 | 0 | 390 | 1 (1) | 3 |
| dj-long (3 roles, teacher closed = 2 pills) | 6.77 | 0 | 390 | 1 (2) | 3 |
| dj-quiet-ig | 1.21* | 0 | 390 | 1 (1) | 3 |
| dj-quiet-noig | 1.21* | 0 | 390 | 1 (1) | 3 |
| dancer-two (bar over today's dancer page) | 3.66** | 0 | 390 | 1 (1) | 2 |

\* The "DN" initials: dark ink on the GOLD disc; the checker walks DOM parents and finds the dark vinyl, not the gold
disc painted by a sibling. On pixels the initials sit on gold (today's hero, unchanged).
\*\* Today's dancer page "STYLE" label on the lightest teal gradient stop (pre-existing, flagged by the mock handover
for the dancer-area PR). Every warm-bar text measures &ge; 7.97.

Seam: the largest one-row colour step down the left column between site header and footer is 2&ndash;3 (out of 255)
in every view, i.e. no hard edge; on the dancer view the warm bar fades in and out.
Clipped text: only the intended ellipsis of "Back to Carlos De La Cruz Fernandez-Montenegro Villanueva".

## Pictures (looked at one by one)

`docs/design/w2c-build/*.png`: dj-roger, dj-one, dj-long, dj-quiet-ig, dj-quiet-noig, dancer-two. Rendered from the
REAL components (`DjRolePage`, `RoleSwitchView`, `PublicDancerPageV2`) in a Vite harness with the mock's fixtures;
the site header and footer in the pictures are stand-ins (the harness does not mount `GlobalLayout`).

## Tests (red first: both files fail on main, the modules do not exist)

- `src/modules/person-page/__tests__/roleSwitch.test.tsx` &mdash; 8 prod role shapes x 3 pages x teacher flag: pills
  equal the ONE mapping (`roleTagsFor`), closed teacher never a pill, 1 role = no pills, no open role = no bar;
  pill text and colour equal the wall `RoleChip`; no role word or hex in the switcher files; flag OFF = Also row;
  flag ON = switcher via `AlsoRoles`; nothing before the person read; no bar when the hub would 404.
- `src/components/dj/__tests__/djRolePage.test.tsx` &mdash; name steps, kicker, London time (BST/GMT/day rollover,
  bare wall clock, date only), dates 0/1/3/4/6/13, no-dates both ways, links, and `DJProfile` flag OFF/ON (order,
  "See 3 more dates" expands, no overflow clip on the name's ancestors, Back to DJs until the bar answers).
