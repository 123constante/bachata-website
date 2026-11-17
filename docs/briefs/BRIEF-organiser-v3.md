# Brief: organiser V3 (Guest list + Raffle live under the V2 shell, plus the two V1 review fixes)

Lane: normal. Repo: Website. Branch: claude/organiser-v3 (off origin/main, which has V1 #1731 merged). One PR, bot-authored. Flag organiserShellV2 stays default OFF.

## What exists (do not rebuild)
- V1 shell: src/modules/organiser/p3/v2/ (V2Shell, V2Tabs, eventChoice). Guest list and Raffle tabs already show the SWITCHED event's nights with GuestListRow/GuestListSheet and RaffleRow/RaffleSheet, behind organiserGuestListLive and organiserRaffleLive (else Coming soon).
- RaffleSheet already has the owner-only open/close confirm step (raffle-confirm). Do not change its behaviour; the raffle RPCs are applied on prod.
- The Door scanner (p3/door/*) already has Scan and List tabs. Do NOT edit p3/door/* or p3/tickets/* (ticketing session).

## Build
1. F1 (review docs/review/REVIEW-organiser-v1-shell-1731.md): with V2 on, a signed-in user with ZERO organiser pages must land on Welcome (P3_PATHS.start), as HomeScreen does today. Fix in V2Home / V2 shell.
2. F2: V2Home must forward location.state; V2EventsTab must render what HomeScreen shows from state and scope: the claim/create confirmation, ClaimNotice and GraceBanner. Reuse the HomeScreen components, no copy of logic.
3. N1: carry ?e= on links to an event page and back (toEvents) where cheap; skip if it needs more than ~15 lines.
4. Door reach: if a signed-in owner or contributor with check-in has no way from the V2 Guest list tab to the Door (route events/:seriesId/door, flag organiserTicketing), add one 44px labelled link on the chosen event's Guest list tab. Link only.
5. Tests: V2 route tests for F1 and F2 (zero pages, state forwarded, notices shown); flag-off parity test still green.
6. Walk (route-mocked fake, flags ON incl. organiserGuestListLive, organiserRaffleLive, organiserTicketing): 390x844 light and dark of Guest list and Raffle tabs with a live night, the raffle confirm sheet, a contributor seat (raffle owner-only message). Add to tests/e2e/walk-v2-shell.spec.ts. No call to organiser_raffle_night_set_v1 on prod.

## Rules
- No DB change, no new RPC, no new product decisions: pick the plain default and list it in the PR.
- Read flags by name (flags.x), never pass `flags` as a value (bundle budget).
- Handover docs/handover/organiser-v3.md: done, left, Not verified.
