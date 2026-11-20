# Editor v2: make the ONE-NIGHT SCREEN look exactly like the approved prototype (PR 1865, branch claude/editor-v2-s1c)
Size: 4 files, 390 lines
Design: the owner-approved prototype is docs/design/editor-v2-proto/event-editor-v2.html.md (the prototype HTML saved as text; open its one-night screen; never read it whole: grep, read with offset/limit). Owner overrides: docs/design/editor-v2-proto/detail-list.md and the 'EVENT EDITOR v2 ONE-NIGHT SCREEN' and 'CANCEL A NIGHT' rows quoted there. Differences found today: docs/design/editor-v2-proto/differences.md.
Owner words (2026-11-20): "Why would you not make it like the prototype?" Same rule: visually the same.
Files: src/modules/organiser/p3/v2/NightV2.tsx, v2.css, copy.ts, and its test. Do NOT touch editorModel.ts, SaveBar.tsx, useEditor.tsx logic. Run AFTER the event-page brief has landed on the branch (same css file); fetch the branch first.
Build, flag stays default off:
1. Header: back chevron, event name over "Thursday 19 November only", "Cancel this night" link top right (moves from the bottom red zone). Grey info box "Changes here are for <date> only."
2. Share this night: two small side-by-side buttons "Copy link" and "Share" (not full-width stacked, not red). Outlined full-width "Copy changes from another date" only if its data exists in S1; else leave it out and say so in the handover.
3. Rows with chevrons for Name / About: "Name for this night", "About this night" show the usual value with small "Usual" label; group titles "Name and about", "Venue", "Picture" as separate cards with small grey caps labels above. Edit opens a sheet (reuse current inputs).
4. Picture: no raw "Choose File" input; a row/card styled as in the prototype that opens the file picker (hidden input behind a styled tap target, 44px).
5. Sessions card: rows with start time over "to" time, title, type and people line, orange "Cancel" on each row; footer orange "Add a session for this night only"; footnote "Tap a session to change ...". A removed session shows "Bring back" in the same row style.
6. Guest list: its own card with a title, "Link for <date> only" subline and a chevron.
7. Cancelled state as the prototype: red box "This night is cancelled. Dancers see Cancelled and your reason" with "Bring this night back", page dimmed.
8. Tickets card: leave the existing placeholder but style it like the prototype card; the real ticket rows are a later slice (say so in the handover).
Proof: extend the walk spec with 390x844 shots (normal + cancelled night), list every remaining difference to the prototype in the handover. All three flags on for the walk.
Out of scope: event page, tickets build, round B.
