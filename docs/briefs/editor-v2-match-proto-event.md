# Editor v2: make the EVENT PAGE look exactly like the approved prototype (PR 1865, branch claude/editor-v2-s1c)
Size: 4 files, 380 lines
Design: the owner-approved prototype is docs/design/editor-v2-proto/event-editor-v2.html.md (the prototype HTML saved as text; open its event page; 62 KB, never read it whole: grep for the event screen class names, read with offset/limit). Owner-picked decisions that override it: docs/design/editor-v2-proto/detail-list.md. Differences found today: docs/design/editor-v2-proto/differences.md.
Owner words (2026-11-20): "Why would you not make it like the prototype? Is this not common sense?" The build must be visually the same as the prototype, not the old organiser form with a save bar.
Files: src/modules/organiser/p3/v2/EventPageV2.tsx, v2.css, copy.ts, and its test. Do NOT touch editorModel.ts, SaveBar.tsx, useEditor.tsx logic (save plan is reviewed).
Build, flag VITE_ENABLE_ORGANISER_EDITOR_V2 stays default off:
1. Header: chevron back button, small grey "Events" line over the event name, green LIVE pill on the right (state pill from the real event status). No site-style orange "Back" link, no big "Edit event" title.
2. THE EVENT card: small grey caps label above the card (not a title inside it). Rows 44px: grey label left, value middle, chevron right. Name, About, Music, Venue, Who runs it are rows that open the existing edit sheet/screen (reuse the current inputs inside a sheet; no open text areas on the page). Long values truncate with an ellipsis.
3. Repeat row: "Every Thursday, no end date" style value with orange underlined "Change repeat" link, no sentence wrapping.
4. PROGRAMME card: rows with start time bold over small grey "to" end time, session title, "Class . people . level" line; "Add a session" orange link at the bottom; footnote "Teachers and DJs are set inside each session."
5. Type and spacing: compact 14-15px, rows 44px (explicit px, phone html font is ~13.5px), card edges and greys as in the prototype CSS.
6. Save bar and leave sheet: only appear after a real change; leave sheet = Save / Throw away / Keep editing (remove the extra "Close" link).
Proof: a walk spec (extend tests/e2e/organiser-editor-v2.spec.ts) taking shots at 390x844; add a side-by-side note in the handover listing every remaining difference to the prototype. Run it with VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_EDITOR_V2=true (all three or the page 404s).
Out of scope: night screen (next brief), tickets, round B items.
