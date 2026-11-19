# Brief: home feed M distance + ticket-tear v6 category row (behind homeFeedLook)

Branch: claude/feed-m-tear (off origin/main). One PR. Class: BUILD-visual. Flags: homeFeedLook + homePolish (flag-off path untouched).
Read first: `~/.claude/plans/DESIGN-REGISTRY.md` row "FEED DISTANCE + CATEGORY MOTION" is the owner's pick; it beats anything else. Mockup source of truth for the motion: round 4 version 6, https://claude.ai/artifact/N8DXCPdSpXdjAZntpRTZcj (read it with the Artifact read action; copy the exact CSS/keyframes of version 6). Round 3 motion 9 = https://claude.ai/artifact/DUw8DzMznTR6PhSkeNaVeo.
Files: src/modules/home-map/cards/AllEventsList.tsx, cards/cards.tsx, cards/controls.tsx, homeMap.css (density exclusions in CLAUDE.md do not touch these).

## Build exactly this (owner approved 2026-11-19)
1. DISTANCE (option M): on each feed row, a big Big Shoulders number in the RIGHT column with a small "mi" under it; the Updated/New stamp sits ABOVE it (top-right stays). Slow ping: always-on soft ring around the number every ~2.4s (motion 9). REMOVE the gold map-pin icon and REMOVE the row-to-map jump: tapping a row only opens the event. Keep "~" tilde distances as today.
2. CATEGORY ROW = "Ticket tear" (control 16), version 6 "fly in + shine + wiggle": five stubs All, Near me, Party, Class, Festival (word FESTIVAL in full, never Fest). Stub swings in from the side with a spring, one light streak sweeps once, selected stub wobbles every few seconds. Near me keeps its location behaviour (asks location, sorts nearest first). Same buttons/roles/telemetry as the current poster row.
3. Rows below SHUFFLE out/in on filter change (~0.2s out, 0.42s in, 70ms stagger).
4. prefers-reduced-motion: no ping, no wiggle, no shuffle, no fly-in (static state).
5. All five stubs fit at 390x844, no clip, words >= 4.5:1 contrast, tap targets explicit px >= 44.

## Must not change (keep-list, feedCardKeepList.test.tsx must stay green ON and OFF)
Card order name > Class line > Party line > venue; Updated/New badge right; everything else on the live screen. Anything else noticed: LIST it in the PR body, do not change it.

## Done
- Update feedCardKeepList test only if the pin/jump removal needs it (say so in PR body).
- PR body: ## Phone QA and ## Verified on real data (project stsdtacfauprzrdebmzg read-only), per `.github/pull_request_template` / pr-body-template.
- Walk at 390x844 with flags on (VITE_ENABLE_HOME_POLISH=true VITE_ENABLE_HOME_FEED_LOOK=true): before/after screenshots, and PROVE the animation runs (screenshots at two times or computed animation-name != none). Report screenshots in the PR.
- No merge. Owner approves the preview first.
