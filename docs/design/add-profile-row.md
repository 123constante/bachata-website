# Design record: Add a profile card (organiser area v2, slice 1c)

Prototype: https://claude.ai/artifact/AXrKLXiAydvMxG367Mr7Pp

## Chosen: look B
A dashed outline card, heading "Add a profile", one 56 px row per missing role (dashed plus tile, bold label, 14 px
benefit line, chevron), then a 44 px "Not now" text button. Last block on the Switch page. Not now hides the card per
person, per browser, with a "Hidden. We will remember this." toast and Undo (portalled to `document.body`).

## Alternatives (not built)
- A: a single "Add a profile" link row that opens a chooser. One tap more; the benefit lines are hidden until opened.
- C: one filled promo card per missing role. Loud; three cards push the page list off a 390 screen.

## Dancer benefit line (worker proposal)
"Keep your nights in one place" -- the dancer app's Nights and Home read the person's going list
(`get_my_going_v1`), so the line promises only what the app does. Rejected: "Show up on going lists" (no public going
list of dancers is shown).

## Notes
- "Get paid for tickets" is the owner's line; the paid-ticket screen is behind `organiserTicketing`.
- Storage throwing: the card still shows; Not now hides it for this visit and the toast says "Hidden for now." (it
  cannot promise to remember).
- Colours: the P3 tokens (`--line-strong` dashed edges, `--mut` benefit text, 7:1 or better in light and dark).
