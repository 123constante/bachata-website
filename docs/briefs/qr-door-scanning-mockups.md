# Brief: mockups for QR door scanning (Design Gate stage 2). Mockups only, nothing built.

Read the plan: `~/.claude/plans/PLAN-2026-10-29-qr-door-scanning.md` is on the orchestrator's PC, so its content is
reproduced here.

## Who and what
Door staff for a bachata night, on a phone (390x844), in a dark room, one thumb, bright screen glare, queue waiting.
Job: scan a buyer's ticket QR, see ONE clear answer in under a second, move to the next person.
Data each ticket has: qr_token, status (valid/refunded/etc), checked_in_at, ticket type name, buyer first name,
quantity of the order. Per night: "N of M in" count.

## Results the screen must show (one shared mapping, table-driven)
ok = LET IN (green) | already in = ALREADY IN at 21:42 (amber, shows when) | wrong event = NOT FOR THIS EVENT (red) |
not paid/refunded = NOT VALID (red) | unknown code = CODE NOT RECOGNISED (red) | offline = NO SIGNAL (grey, use the list).
Every state says what the door person should DO next.

## Make 3 named HTML mockups (standalone files, 390x844, no frameworks, same tokens/colours as the organiser area
`src/modules/organiser/p3/theme/p3.css` and DESIGN.md at repo root; read them)
A) Camera full-screen with a result sheet sliding up from the bottom.
B) Camera in the top half, always-visible result card and counter in the bottom half.
C) Camera plus a "tonight's list" tab (first name + quantity + in/not in) for dead cameras and no signal.
Each mockup shows all six result states, the "N of M in" counter, a manual code entry, and the empty state
(no tickets sold yet: say what the person can do). Taps at least 44 px, text contrast at least 4.5:1 (explicit px sizes:
the public site's html font size is about 13.5 px on phones). No Unicode punctuation in files: use HTML entities.

## Output
Push `docs/design/qr-door-scanning/{A,B,C}.html` + `docs/design/qr-door-scanning/README.md` (the 5-line brief, what
differs, your recommendation with a reason) on your branch. Do NOT touch `src/`. Context cap 30%. Last commit subject ends
with the worker-done marker.
