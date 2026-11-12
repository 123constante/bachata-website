# Organiser dashboard: 3 design options (design record)

Admin #1538, parent #1531. Docs/design only: no app code, no DB. **The owner picks.**

Read first: [INVENTORY.md](INVENTORY.md). It lists every field, state and option of today's
organiser area, with `file:line` citations, mapped to the contract journeys O1-O4.
It covers 90 of 127 items; the other 37 are excluded by the contract or listed as gaps (GAP-1..7).

## Files

| File | What it is |
|---|---|
| `option-a.html` | Option A, **Feed**, adapted from `docs/briefs/org-proto-dashboard.md` (brief branch) |
| `option-b.html` | Option B, **One night in focus** |
| `option-c.html` | Option C, **Scoreboard + next steps** |
| `shots/option-X--<state>.png` | First screen at 390x844 (`@2x`) |
| `shots/option-X--<state>--full.png` | The same state, full page |
| `checks.json` | Raw output of the mechanical checks, per option and state |
| `tools/gen.py` | Builds the 3 HTML files from one shared data model and one set of shared blocks |
| `tools/check-shots.mjs` | Takes the screenshots and runs the checks (Playwright) |

To see one state, open a file with a hash: `option-b.html#huge`. The states are `no-events`, `upcoming`,
`selling`, `huge`, `all-zero` and `cancelled`; with no hash the file shows `upcoming`.
To rebuild: `python3 docs/design/organiser-dashboard/tools/gen.py && node docs/design/organiser-dashboard/tools/check-shots.mjs`.

## The contract, and where each option meets it

All three options use the same data model and the same blocks for every fact, so one fact is never
shown two ways. That shared code is in `tools/gen.py`: `stat_parts`, `rating_lines`, `share_block`, `cancelled_card` and `empty_next_action`.

| Journey | How all 3 options meet it |
|---|---|
| O1 no events / no team | A "Next step: Add your first night" card with Add a night and Invite someone to help. The Share my page block has Copy, WhatsApp and Caption (an Instagram caption) buttons. Every empty line says what to do next. |
| O2 upcoming nights | Each night shows Going, Opens, and link taps by type (Ticket link, Share, WhatsApp, Directions). Numbers are **positive only**: a zero is never printed. A zero turns into a suggested action instead, such as "Nobody has said they are going yet / Share it" or "No ticket taps yet / Add a ticket link". |
| O2 cancelled night | A red "Cancelled" card. It explains what dancers see, gives the opens before the cancel, and has Tell your dancers and Undo. Cancelled nights are left out of every total. |
| O3 selling via us | A Tickets sold figure that **appears only when it is above 0**. It is the tile in A, the lead number in B and the first scoreboard cell in C. |
| O4 profile and ratings | A completeness bar with the single next step as a button. **Rating and Level rating are always shown**, as "No ratings yet" or "No level votes yet" with what to do when empty. The city average appears **only when the city has 5 or more organisers**: it shows in the London states and is hidden in Leeds (3 organisers) and Bristol (2). |
| Excluded | There are no page-view tiles, charts, enquiries, saves, weekly summary or source split on opens. |
| Visibility | One layout for the whole team, with no per-role variants (GAP-6). |
| Light and spacious | Each option puts **1 main card and 3 items** on the first screen (see each option below). |

## Tokens (shared; taken from the existing prototype)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0B0C` | page |
| `--s1` / `--s2` | `#151517` / `#1D1D20` | card / inner tile, hint, button |
| `--line` | `#2A2A2E` | borders, dividers, empty bar |
| `--text` | `#F4F1EA` | main text (17.4:1 on `--s1`) |
| `--mute` | `#A7A29A` | labels and secondary text (lowest measured contrast 6.63:1, on `--s2`) |
| `--gold` / `--ink` | `#E0B252` / `#14110A` | primary action and links / text on gold |
| `--ok`, `--warn`, `--bad` (+`bg`) | `#7DDBB4`, `#F0A35E`, `#F08A8A` | Done, Next step, Cancelled chips |
| Type | system UI stack, 14px body, 12px labels, 22px numbers (B lead 40px), `tabular-nums` | |
| Tap target | `min-height:44px; min-width:44px` on every button and link | |
| Radius | 12px cards, 10px buttons, 999px chips | |

All sizes are in **px**, not rem. The public site sets `html` font-size to about 13.5px on phones, so
rem sizes would render about 16% small (CLAUDE.md trap). The real build should keep these as px.

## Option A: Feed (adapted from the existing prototype)

**First screen:** the main card is the next night, with up to 4 positive tiles and "N more". The 3 items below it are
the later nights as compact rows (a one-line summary each), Share my page, and Your profile.
**Shots:** `shots/option-a--*.png`.

- **Pros:** It is closest to the prototype that has already been reviewed, so it carries the least design risk. Big numbers sit in tiles that
  hold 63,576 easily at 390px. Every later night is one tap away.
- **Cons:** With 3 or more nights, Share and Profile fall below the fold, so the first screen is mostly
  numbers. The first night's tiles take about 400px. The "N more" link hides the rest of the click types.
- **Fits best:** an organiser with one or two regular nights who checks how the next one is doing.

## Option B: One night in focus

**First screen:** the main card is a hero for the next night. Its lead number is Tickets sold when selling, otherwise Opens,
shown at 40px. Every other positive metric is a pill, and Share this night is the primary button. The 3 items are a list:
N more nights, Share my page, and Profile N of 6 with the rating.
**Shots:** `shots/option-b--*.png`.

- **Pros:** It meets "1 main card + 3 items" most exactly in every state, including huge counts (see
  `option-b--huge.png`). It shows every click type with no "more" link. The share action sits
  right next to the numbers that make an organiser want to share.
- **Cons:** Later nights are one tap deeper (the mock shows them expanded below the fold). Pills wrap to three rows
  when all 4 click types and Going are positive. A 40px lead number can make one metric look like the only one that matters.
- **Fits best:** the "is tonight going to be busy?" moment, which is the most common reason to open the app on a phone.

## Option C: Scoreboard + next steps

**First screen:** the main card is a 2x2 scoreboard that adds up every upcoming night that is not cancelled (positive cells only;
an odd last cell spans both columns). The 3 items are a Next steps checklist: Share my page, Profile N of 6 with its next step, and Team
(Invite, or a tick when there is a team). Night-by-night cards follow below.
**Shots:** `shots/option-c--*.png`.

- **Pros:** It shows the whole team where they stand in about 2 seconds. The checklist turns O1 and O4 into
  jobs to do, and stays useful even when every number is zero.
- **Cons:** The totals mix nights together, while O2 asks for per-night numbers, and those per-night numbers sit below the fold.
  The all-zero scoreboard is replaced by a share prompt, so the first screen changes shape from week to week.
  The rating appears only far down the page.
- **Fits best:** organisers who run many nights, or a team that wants a single health number.

## Recommendation

**Option B**, while keeping Option A's compact later-night rows, which B already uses below the fold. Reasons:

1. B is the only option where the first screen has the same structure in all 6 states: a hero or the Next step card, then the same
   3 items. A's first screen fills with tiles, and C's main card changes meaning.
2. It is per-night by construction, which is what O2 asks for. C needs per-night data that does not exist yet (GAP-4)
   and then adds it back up into totals.
3. The positive-only rule and the zero-means-action rule read most naturally as pills plus a hint inside one card.
4. The huge-count state fits without clipping: 6,013 at 40px and 63,576 in a pill.

If the owner wants the least change from the reviewed prototype, pick **A**. If the main user is a team
that runs many nights, pick **C**.

## Option A v2: Opus critique fixes (admin #1544)

`option-a.html` and `shots/option-a--*.png` are now **v2**. B and C are unchanged apart from the shared data fixes
(huge-state Tickets sold, no-events profile step). Run `python3 -I docs/design/organiser-dashboard/tools/test_mapping.py`
for the Option A consistency matrix (every state x every night).

| # | Fix | Where in `tools/gen.py` |
|---|---|---|
| 1 | Light theme: bg `#F7F6F3`, card `#FFFFFF`, line `#E4E1DA`, text `#1A1916`, mute `#5F5B54`; gold text and links `#8A6414` (5.4:1 on white); bright gold `#E0B252` only as a button fill with ink text; light chip backgrounds | `A_CSS` |
| 2 | One gold primary per screen once a night exists: **Share this night** (WhatsApp with the night link). Share my page (Copy / WhatsApp / Caption) is secondary | `a_share_night_btn`, `a_share_block` |
| 3 | Going is a line in the card ("3 going"), never a tile. Zero = a hint sitting right above the Share this night button | `a_main_night`, `a_metrics` |
| 4 | Max 4 tiles: Tickets sold (if > 0), People who opened, Ticket link taps, Share taps. Other positive types in one muted line ("9 WhatsApp taps &middot; 21 directions taps"). No "N more" link; the detail link is labelled **Night details** | `A_TILES`, `A_LINE` |
| 5 | Label **People who opened** + note "counted once per person per day", in the main card and under the later-night rows | `OPENS_NOTE`, `a_later_rows` |
| 6 | Cancelled: a compact notice with the gold **Share the cancellation** (prefilled WhatsApp text shown); Undo is a quiet text link with the confirm "Put this night back on the calendar?" (drawn at the bottom of the page). The main card goes to the next live night, whose share button turns secondary | `a_cancelled_notice`, `A_UNDO_CONFIRM` |
| 7 | Huge: Tickets sold 4,127 vs Ticket link taps 6,013. Each tile names its source in `A_TILES`; a test asserts the two sources differ | `A_TILES`, `test_mapping.py` |
| 8 | No events: city unknown = "dancers near you" (new state `no-events-no-city`, profile step "Add your city"); city known = "dancers in Leeds", profile step "Add a photo" | `a_empty_next_action`, `data()` |
| minor | Share my page buttons are icon over label (no more ~6px padding on WhatsApp at 390) | `.sbtn` |

Still holding: 6,013 / 63,576 fit, long names clamp to 2 lines, no zero printed, Rating and Level rating always shown,
city average only in London, every tap target 44px or more. Checks: **19/19 pass** (A now has 7 states); A's lowest
contrast is 4.97:1 (gold text `#8A6414` on the `#F2F0EB` hint fill).

## Checks (all 18 option x state screens)

Run with `node docs/design/organiser-dashboard/tools/check-shots.mjs` at a 390x844 viewport. The raw results are in `checks.json`.

| Check | Rule | Result |
|---|---|---|
| Tap targets | every visible `a` and `button` is at least 44x44 CSS px | **18/18 pass**. The first run failed on Option A's "All" link (18x44), now "All nights" at a 44px minimum. |
| Contrast | every visible text node is at least 4.5:1 against its composited background | **18/18 pass**, lowest 6.63:1 (`--mute` on `--s2`) |
| Sideways scroll | `documentElement.scrollWidth` is at most 390 | **18/18 pass** (390 everywhere) |
| Clipping | no element with text overflows its box (non-visible overflow) or extends past x=0..390 | **18/18 pass** |

Page heights at 390 wide: A 844 to 1,118px, B 965 to 1,366px, C 942 to 1,518px.
Long names (a 2-line clamp) and venues (wrapped) are tested in the `huge` state.

## Data the options need that does not exist yet (from the INVENTORY gaps)

Each of these is drawn as if the data exists. Build work must close the gap first, or drop the element.

- **GAP-1 Rating (overall) and city average.** Only the per-series Level vote exists (`mostly_beginners / mixed /
  strong`), and there is no count of organisers per city. The mock draws Level as a label ("Mixed levels, from 18 dancer votes"),
  not as a score.
- **GAP-2 Share my page.** Today the only share is a link to the next live event with `?ref=`. A page link, a WhatsApp share and an Instagram
  caption are all new.
- **GAP-3 Cancelled night.** The server drops cancelled nights (`get_organiser_nights_v2`, `organiser_home_v1`). The owner's E7
  decision is pending.
- **GAP-4 Per-night opens and clicks.** Opens are counted per series per day and clicks per series in total. The type names also need mapping:
  the site sends `ticket / instagram / whatsapp / share / organiser_external / other` (directions arrives as `other` with
  source `:directions`).
- **GAP-5 Page opens line.** Nothing reads `profile_view_events` for organisers, and the public organiser page does not
  record a view when it loads.
- **GAP-6 Whole-team visibility.** Today analytics are owner and manager only, Going is hidden from contributors, and ticket money is owner only.
  The mocks show one view to everyone and never show money; a count only.
- **GAP-7 The admin repo was not readable** in this session, so the admin-side items are cited from Website docs.
