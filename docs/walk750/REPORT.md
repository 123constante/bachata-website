# Walk of PR #750 final tree (b92bdee) at 390x844

Fake backend (`helpers/organiserFake.ts`), Chromium emulation. Spec: the brief's, unchanged (untracked, not committed).

## Setup note (not a product change)
The first run failed on the list page (redirect to `/city/london-gb` "Page not found"), and so did `organiser-events.spec.ts` (11 failed). Cause: my shell lacked the env that `e2e-smoke.yml` sets. With `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (the CI placeholders) and `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, both pass. The spec was not edited.

## Console lines (verbatim)
```
TYPEROWS
01 | Type Set by its sessions across all its dates. Class
11 | Type Set by its format. Course
12 | Type Set by its format. Festival
13 | Type Set by its sessions. Night
14 | Type Add a session to one of its dates and it is set for you. Not set
15 | Type Set by its sessions. Night

CREATEY 364.375,364.375,364.375 size 358x52

CHIP class 62.265625x44

CHIP party 84.25x44

ENVELOPES series.upsert,series.add_date
```

## Exit codes
- `zz-walk-750.spec.ts` (chromium): 0 (1 passed; every overflow assertion held)
- `organiser-events.spec.ts` (chromium): 0 (11 passed)
- `npm run build`: 0

## Screenshots
- 01-list.png: 7 events with date tile, venue and Live/Draft/Ended/Archived pills, "New event" button, BottomNav. Nothing wrong. Rows are not sorted by status (Draft, Ended, Archived sit between Live ones) -- observation only.
- 02-editor-01.png (Friday Bachata, class+party): Live; Type "Class", sub "Set by its sessions across all its dates." Nothing clipped. Note: a series holding class AND party reads "Class".
- 02-editor-11.png (course): Type "Course", "Set by its format." Fine.
- 02-editor-12.png (festival): Type "Festival", "Set by its format." Fine.
- 02-editor-13.png (ended): Ended banner "ask the Bachata Calendar team"; Gallery/Type rows dimmed; Type "Night". Banner points at the team, not a control. Fine. "Night" for a party series is a wording choice to confirm.
- 02-editor-14.png (draft, no sessions): Type "Not set"; the sub-line is CLIPPED with an ellipsis: "Add a session to one of its dates a..." -- the full sentence is not readable. It also points at "one of its dates", which is not on screen in this capture.
- 02-editor-15.png (archived): banner, rows dimmed, Type "Night". Fine.
- 03-new-blank.png: name field, three chips Class/Party/Workshop with none chosen, hint "Choose one...", Create event. Fine.
- 04-new-class.png: Class ticked; hint "Make it weekly later from Repeats." The Repeats control is not visible on this screen or in any editor capture.
- 04-new-party.png: Party ticked. The Class chip keeps an amber outline after deselect (looks like leftover focus/hover state; confirm on a real phone).
- 05-after-create.png: editor for "Walk Thursday Class", Draft, Type "Class", "All changes saved". Fine.

Taps: both chips and the Create button measure at least 44px tall (chips 44, Create 52). Create does not move (y=364.375 in all three states). No horizontal overflow on any screen.

Limits of the capture: the editor scrolls inside its own container, so the "fullPage" PNGs show only the first 844px. The rows below Type (dates, Repeats, venue, Send for review) were not captured, so I could not check them.

## Verified / Not verified
Verified: the three commands above exit 0; the six Type rows; chip sizes; Create button position; the envelope sequence (series.upsert, then series.add_date) for a class create; no horizontal overflow; each PNG viewed.

Not verified: a real phone; a real keyboard; a real upload; real Supabase (fake backend only); Chromium emulation only; anything below the Type row in the editor; GitHub CI (not run). The amber outline on the Class chip, the clipped Draft hint and the "Repeats" pointer are findings for the owner to judge.
