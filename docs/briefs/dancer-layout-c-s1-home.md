# Dancer layout C, slice S1: Home regrouped (Get ready / Go out / Be found)
Repo: 123constante/bachata-website. Branch: claude/dancer-layout-c-s1. Lane: normal. Model: opus.
Size: 5 files, 360 lines
Brief-version: 2
Design: DESIGN-REGISTRY row "Dancer dashboard" (layout C picked 2026-11-20). Prototype: https://claude.ai/artifact/HdwfoouZXEQvXM8LaXDyVF (option C, Home phone). Spec: docs/briefs/dancer-layout-c-spec.md (same folder).
Flag: new `VITE_ENABLE_DANCER_LAYOUT_C` read in a new `layoutCFlag.ts` (`DANCER_LAYOUT_C_ENABLED`, read like `dashBFlag.ts`). Flag OFF = today's Home, byte-for-byte behaviour. Flag ON = layout C Home, built on the Option B view (DANCER_DASH_B_ENABLED path); with C on, C wins over the A/B flag.
Rules: HTML entities in JSX (`&mdash;`, `&rsquo;`), explicit px for tap targets, 390x844 first.

## Files
- src/modules/dancer-app/screens/home/layoutCFlag.ts (new)
- src/modules/dancer-app/screens/home/homeOptionB.tsx
- src/modules/dancer-app/screens/home/homeFocus.ts
- src/modules/dancer-app/screens/home/HomeScreen.tsx
- src/modules/dancer-app/screens/home/__tests__/homeLayoutC.test.tsx (new)

## What changes (Home only, flag ON)
Order top to bottom: h1 "Hi <name>" | alerts (paused banner, linked notice: moved ABOVE the focus card, same copy) | head "Get ready" + focus card (profile steps) | head "Go out" | head "Be found".
Section heads are small uppercase labels (use the prototype's `.head2` look: 11px, uppercase, letter-spacing .08em, bold, muted).
"Go out" content order: (1) Rate last night tile (RateNudge; only when GOING_CHECKIN_ENABLED and a candidate exists) (2) "Your ticket" card = the existing TicketCard/useTicketCard from screens/tickets, only when flags.publicTicketing is on and TICKET_TEASER off (it replaces the Tickets tab; reuse the component, do not copy) (3) night card OR "Nothing planned yet" + "Find events this week" (today's focus kinds night/find, when the profile is complete) (4) "N more plans" row (-> /app/nights) (5) "N nights attended" or "Your first night out" row LAST (not tappable).
"Be found": "Share my page" row (same enabled/disabled-with-reason logic as today), "Preview my page" row (-> /app/page; this row moves here from Me; Me loses it in slice S2).
Profile focus card stays under "Get ready" while profile is incomplete; when complete, "Get ready" head is hidden and the focus slot is empty (the night/find card lives in Go out).
no_profile state (Claim card + NoProfileWayOut) unchanged. Loading and error cards unchanged.

## Prototype checklist
- [ ] h1 "Hi Ana"
- [ ] alert: "Your dancer profile is hidden. Only you can see it." + "Show my profile again" (only when paused), ABOVE Get ready
- [ ] alert: "We've linked your profile" + Check my profile / Got it (only when linked), ABOVE Get ready
- [ ] head "Get ready"
- [ ] focus card "2 of 4 / to finish your profile", 4-segment bar, "Next: ..." line, CTA button (e.g. "Add your photo")
- [ ] head "Go out"
- [ ] row/tile "Rate last night" (Going on only), FIRST in Go out
- [ ] "Your ticket" card (ticketing on only), second
- [ ] "Nothing planned yet" card + "Find events this week" button (or the next-night card)
- [ ] row "N more plans" (only above 0)
- [ ] row "Your first night out" / "N nights attended", LAST in Go out, not tappable
- [ ] head "Be found"
- [ ] row "Share my page" (+ disabled reason when incomplete or hidden)
- [ ] row "Preview my page" (-> /app/page)
- [ ] tab bar is out of scope here (slice S2); do not touch routes or shell

## Done when
Table-driven test `homeLayoutC.test.tsx`: for each state (profile incomplete, complete+night, complete+no night, paused, linked, ticketing on, going off, 0 vs N attended, no_profile) the DOM order of heads and rows matches the checklist; flag OFF renders exactly the old Home (existing homeOptionA/B/Audit tests stay green untouched). Each new test red on old source.
Do not touch Me, Options, Nights, shell, routes, AccountSettings. Anything noticed but not in this brief: LIST it in the handover, never change it.

## TAP TABLE (mandatory in handover)
End the handover with a TAP TABLE: button | destination | prototype/OLD. Any tap that leaves the prototype (old page, today's screen) = not done; one OLD row = keep building. A prototype element you cannot build: STOP, write it at the TOP of the handover; never ship a "remaining differences" list as done. Checkpoint PR at 60% of your limit.

## Inventory first
INVENTORY.md for this slice = docs/briefs/dancer-layout-c-spec.md (live inventory of every row, tap and flag, already written). Before building, tick each Prototype checklist line against it; end the handover with a coverage count: "coverage N of N checklist lines built".

## What main lacks
- extends: Home grouped under Get ready / Go out / Be found behind a new flag, ticket card on Home -- src/modules/dancer-app/screens/home/homeOptionB.tsx
- the layout C flag file does not exist yet -- src/modules/dancer-app/screens/home/layoutCFlag.ts
