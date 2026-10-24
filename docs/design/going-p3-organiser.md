# Design record -- Going P3: organiser "who is going" (Design Gate stages 3-4)

Brief: `brief/going-p3-organiser:briefs/going-p3-organiser.md`. Stacks on Going P2 (#992).
Components only: no routing, no page placement, nothing under `src/modules/organiser/**`.

## Stage 3 -- the look, from C2 only

Source: mockup C2 (`claude/er-p3-mock-c2:docs/organiser-rebuild/p3/mockups/C2.html`).
The three slots the rebuild will mount us in, and what we give each:

| C2 slot | C2 markup | Our part | Notes |
|---|---|---|---|
| Home "Next up" hero | `.card.pad` with `.when` + `.big` | `GoingNightSummary` under the title | count line, 15px; chevron when there is a list |
| Date-strip sheet row "Who's going (12)" | `.row` (min-height 64, padding 10/16) | `GoingNightSummary` at the row's end, `onOpen` opens the host sheet | the host owns the row label and the sheet |
| Stats "By event" row | `.row` with `.t` + `.s` "N views" | `GoingNightSummary` under the views line | the count sits beside views, same `.s` muted size |
| The sheet | `.sheet` (`--sheet`, `--r-sheet`), `h3` 20px/600 | `GoingPeopleSheet` inside it | heading, night line, count, the list scrolling inside |

Tokens (all existing; `ORGANISER_GOING_THEME` in `src/modules/going/goingTheme.ts`, values come from the organiser's
own `.org-theme` / `.ember-world` -- the C2 names, so the parts follow whichever organiser look hosts them):

| Use | Token |
|---|---|
| Names, a count with people | `--fg` |
| Night line, 0 / cancelled words, refusal words, "+N more" | `--mut` (ember contrast test holds it to 4.5:1) |
| Initials circle | `--card2` fill, `--fg` letter, `--card` ring |
| Row divider | `--line` |
| Try again / Sign in again | the C2 `.btn.line` look: `--card2` fill, `--line-strong` border, `--fg` text, radius 15px |

No new colour, no hex in the components. Sizes are explicit px (the public site's html font-size makes rem ~16% small).

Decisions:
- **0 going and cancelled-with-nobody are text, never a button**: there is nothing to open, so no dead control.
  A cancelled night with people (`3 had said they were going`) stays openable: the organiser may want to tell them.
- **Cancelled wins over the count** everywhere: "This date is cancelled", never "0 going".
- **The host opens the sheet.** `GoingNightSummary` calls `onOpen(night)`; without `onOpen` it is plain text.
- **No sheet chrome** in `GoingPeopleSheet` (no scrim, grab bar or close): the rebuild's `SheetView` owns them.
- **The error line** reads "Couldn&rsquo;t load who&rsquo;s going." with a "Try again" button beside it -- the brief's
  sentence, split so the action is the button (the P2 copy, reused).
- **Rows are 56px** (40px face), names wrap (`overflow-wrap: anywhere`): the longest finished first name on prod is 21 chars.
- **Telemetry**: tapping a linked name calls `emitProfileView` (context `organiser-going`), per the data-contracts rule.

## Stage 4 -- measured

29 scenes (4 components x 6 night shapes + 5 read states) at 390x844, in the ember tokens. Every scene PASSES:
min text contrast 5.55 (the C2 `.when` gold line, which is the host's) / 5.84 for our own muted text; every tap
target >= 44 x 44 (rows 56px tall); no sideways scroll; no clipped or spilling text; the 200-person list scrolls
inside the sheet. Per-scene numbers: [`docs/handover/going-p3/INDEX.md`](../handover/going-p3/INDEX.md).

One defect found and fixed by the walk: with the long cancelled line, the summary did not shrink in a flex row and
its text ran over the row label. The summary now has `min-width: 0`, and the harness checks for text spilling out of its box.
