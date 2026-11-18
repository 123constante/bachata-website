# Brief: organiser area Round 4 (white + orange), whole app

Owner said "build this" 2026-11-18: all 19 Round-4 screens, real data for every stat.

## Why
Live organiser area (src/modules/organiser, #655, 8 Oct) is mockup v12: DARK theme (theme.css, bg #0f0d0b, gold #ffa600). Owner picked Round 4 on 2026-11-17: white + orange #C2410C. It was never built.

## Source of truth (read first)
- ~/.claude/plans/DESIGN-REGISTRY.md rows "Organiser area base", "Organiser accent colour", section "Organiser design direction" (lines 25-36).
- The 19 Round-4 screens are exported as HTML at docs/design/organiser-round4-md/R4*.md (HTML source inside a code fence) (same branch). The cloud worker cannot open the private canvas: build from these files. Each is a 390x844 board; exact colours, sizes, copy and tab order are in the markup. Links between boards show the flow. Strings like [DOOR LINK], [GUEST NAME], 54 came, 62 going are placeholders: use real data.
- Round-4 canvas beats older prototypes for LOOK; older ones are content source only.

## Style guide (owner approved)
White cards, 1px grey hairline borders, no shadows, 8px radius, small uppercase grey labels above bold numbers, 2-up stat tiles, full-width list rows with status pill + chevron, orange #C2410C only for main action/active state, red only for danger. Body 16px, buttons 48px, main action full width, no sideways-scrolling tables, bottom tabs kept, no charts, no developer words. Phone html font ~13.5px: use explicit px for tap targets.
Every organiser screen: always-visible top-left "Back to bachatacalendar.co.uk" link (44px white bar above 48px header, 12px 500 #464646, chevron).

## Screens
1-5 Home through the day (before = H-C scoreboard + Share; on the night = door mode, scanner + guest list; after = how it went) + Compare nights (simple ranked list) + Switch page.
6-10 Events and one night (raffle inside each night + status on Home; reminder row per registry).
11-15 Tickets (K-B, one night in focus) and Team (T1 grouped by role).
16-19 Door staff (separate simple screen: scan + search only), door invite link, empty states.

## Real data (owner click)
Replace board placeholders ("54 came", "9 of 12", Compare numbers, [CODE]) with real values: checked-in, tickets sold, money, best link. Stat with no data: hide it, never show a fake. Raffle "Pick the winner" disabled before doors close. Contributor group not drawn: omit.
Backend absent (e.g. reminder sender, per-night flag): UI stays hidden behind the flag; no migrations here (schema authority = bachata-admin-11april). Note gaps in the PR.

## Rules
One branch, one PR, behind a flag (default off). Keep existing behaviour/routes/tests green. Read CLAUDE.md, .claude/rules/*.md, docs/website-rules-detail.md. Use scripts/safe-edit.py / safe-write.py for files over 2 KB. HTML entities in JSX. Verify at 390x844 on prod-shaped data; add a "Verified on real data" PR block. Partial is fine: push early, mark what is left.
