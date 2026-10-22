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

## Numbers (first build, harness; 390x844, html font-size 13.5 px, `report.json`)

*Superseded for the DJ page by the fix pass below: the harness had no `GlobalLayout`, so it could not see the
seam, and its DJ pictures were replaced by real-app ones.*

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

First build: dj-roger, dj-one, dj-long, dj-quiet-ig, dj-quiet-noig (REMOVED in the fix pass, replaced by the
real-app pictures listed below; `dj-long.png` is now the real-app one), and dancer-two (kept). Rendered from the
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

## Fix pass (ticket dt_f255fcd10ccb, 2026-10-22)

### 1. "Something went wrong" on 21 of 40 real DJs

`get_public_dj_v1` returns `faq` as an ARRAY (21 DJs, all `[]`; 19 null), and the page called `p.faq?.trim()`.
Fixed for the class: every field the flag-ON page reads from the row goes through ONE boundary,
`djRoleFields(row)` in `src/components/dj/djRoleModel.ts`, built on `djText(v)`: string &rarr; trimmed or null;
array of strings &rarr; one per line (empty &rarr; null); anything else &rarr; null; never throws. Covered: bio, faq,
pricing, city, nationality code, photo (string or array), gallery (non-strings dropped), SoundCloud, Mixcloud,
Instagram, website (then today's `splitInstagramWebsite`), Facebook; gig name / location / time (`gigRows`,
`gigWhen`). The flag-ON branch in `DJProfile` now runs BEFORE today's raw reads (`firstPhoto`,
`splitInstagramWebsite(dj.instagram, dj.website)`), which assume strings. `DjRolePage` calls no string method on
its props. Flag OFF: the same JSX as before (the moved lines only changed position, below the flag-ON return).

### 2. Colour seam below Share

Cause: the page's `WALL_FADE` fades its bottom 64 px to clear, onto `GlobalLayout`'s `default` ground,
the cool graphite `#0E1215`. The mock is warm to the footer. Fix: a `wall` page ground (`#1E1410` =
`WALL.page`, pinned by a test) and the flag-ON DJ page (and its loading skeleton) uses it; `<body>` is painted
warm too, so the strip above the footer matches.

Measured on the REAL app (react-router dev server with `GlobalLayout` + site header/footer, a local mock
Supabase serving the prod shapes), 390x844, columns x=6 and x=384, from below the site header to the footer top
(`walk.json`):

| View | ground mid-page | ground above footer, before | after | largest one-row step, before / after |
|---|---|---|---|---|
| dj-many, dj-none-ig, dj-none-noig, dj-pricing, dj-long | rgb(30,20,16) | **rgb(14,18,21)** (cool, B &gt; R) | rgb(30,20,16) | 1 / 0 |

Honest note on the metric: the one-row step reads only 1 on the broken page, because a 64 px fade changes
less than 1/255 per row. That is why the first build's report (2&ndash;3, harness without `GlobalLayout`) did not
catch it. The number that shows the seam is the ground colour mid-page vs above the footer: before, a
16-step drop in red with blue rising (warm brown &rarr; blue-grey navy); after, identical.

### 3. Pictures (real app, looked at one by one)

`docs/design/w2c-build/`: `dj-many` (13 dates, faq `[]`, 3 held roles, teacher closed = 2 pills),
`dj-none-ig` (no dates, Instagram handle, DJ only), `dj-none-noig` (no dates, no Instagram), `dj-pricing`
(pricing string, 2 dates), `dj-long` (long name wraps, 4 dates = "See 1 more date"), and
`seam-before-dj-many` (the cool band below Share, before the fix). The first build's harness pictures of the DJ
page were removed (superseded); `dancer-two.png` and `report.json` are the first build's and unchanged.
None shows an empty FAQ or Pricing card; none has a horizontal scroll (scrollWidth 390).
`dj-none-ig` and `dj-long` show "Back to DJs": the mock serves no dancer row for those two, so the person read
says the hub would 404 and the bar keeps its fallback. A DJ page id is a `dancer_profiles` id, so on prod
the bar should resolve for them; NOT verified on prod.
