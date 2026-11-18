# Organiser Round 4 continuation 3 (branch claude/organiser-r4)

Read first: `docs/handover/organiser-round4.md` (Done and Left), the brief `docs/briefs/organiser-round4-restyle.md` and boards `docs/design/organiser-round4-md/R4*.md` on `brief/organiser-r4`.

SCOPE (one group only, finish it fully): R4EditNight (board's one-form layout), R4Cancel (board's "N going will be told, N refunded" sentence; if no read exists, hide the sentence and say so), R4Raffle (Open / Entries / Closed / Winner track, "Pick the winner" disabled until doors close; raffle RPCs are behind ORGANISER_RAFFLE_LIVE, build the screen against that flag and say what was not verified).

OWNER RULES (2026-11-18, after the first two workers recoloured old screens):
1. A screen is done ONLY when it has the board's layout. Re-pointing colours on the old screen does NOT count as done.
2. For each of the three boards, take a 390x844 screenshot of your screen and compare it to its board. In the PR body and handover list one line per board: MATCHES, or DIFFERS with exactly what and why (missing read, flag off). No line = not done.
3. Do not start another group. If you finish early, stop and hand over.
4. Real reads only; hide any stat with no read. Behind `VITE_ENABLE_ORGANISER_R4`, default off. Matrix test per screen x prod data shape. HTML entities in JSX, British English.
5. Update the handover Done/Left before stopping; push often.
