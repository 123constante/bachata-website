# Organiser Round 4 continuation 1 (branch claude/organiser-r4)

Read first: `docs/handover/organiser-round4.md` on the branch (what is done and the "Left" list), the original brief `docs/briefs/organiser-round4-restyle.md` and boards `docs/design/organiser-round4-md/R4*.md` on `brief/organiser-r4`.

Task: build the "Left" screen groups from the handover, reusing `r4.css` classes, behind `VITE_ENABLE_ORGANISER_R4` (default off). Real reads only; hide any stat with no read. Priority order: Events/Night/EditNight/Cancel/Raffle, Tickets/Refund/EmptyTickets, Team/AddTeammate (give Team a back that stays in the R4 frame), Compare, Door screens, EmptyHome, "Things waiting for you" list.
Keep the same PR (#1790). Add matrix tests per screen x data shape. Walk at 390x844. Update the handover Done/Left lists before stopping; push often.
Owner rules: whole app, real numbers, flag default off, British English, HTML entities in JSX.
