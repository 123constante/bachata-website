# Brief: Near me wait effect + map fit (add to PR #1828, branch claude/feed-m-tear)

Class: BUILD-visual, behind existing flags `homeFeedLook` + `homePolish`. No new flag. Same PR #1828, push to its branch. No DB, no migrations.

## Owner picks (click answers 2026-11-19, mockups r6 F5YwTsGEnBC4bkEoMkQyVH, r7 7qtCmHM5btYj3YRaKSGEVz, r8 H5tDPVoC4oRYPYbR5esVJp; read them with the Artifact read action if tools allow, else follow the text below)
1. WAIT EFFECT (r6 #2 "Radar sweep"): after the user taps Near me and until the coords resolve, a radar arm (conic-gradient amber glow, 2.4s linear spin, origin at the map card centre, large circle) crosses the WHOLE feed screen as a pointer-events:none overlay. No words. When distances land, the overlay goes. Reduced motion: no animation, still show nothing misleading. Distance numbers stay hidden while waiting, then pop in (existing behaviour).
2. MAP FIT (r7 #2): when coords arrive, the home map card draws the device position as a pin with the word "You" above it, pulsing BLUE (pin #3b8cff, white border, two expanding ring pulses 1.6s, label pill blue with white text). The map then moves ONCE (animated) to a frame holding the user pin plus the 5 nearest venues (use existing `distanceMiles` ordering from mapTypes). Zoom must not exceed the existing max and respects the card's `minZoom` 10.
3. CONTROL (C): after the fit, the map cannot be dragged far from the user: `maxBounds` = bounds of the user pin plus nearest 5 padded about 50 percent, `maxBoundsViscosity` high. Teaser card stays a teaser (taps open the full map), so apply bounds only where the card is pannable; if the card is tap-only teaser, apply the bounds to the full map page view the user reaches by Open map and say so in the PR.
4. NUDGE (r8 #4 "Map breathes"): the map card background slowly drifts in (scale 1 to 1.07, 6s ease alternate) and the venue dots softly twinkle (box-shadow 0 to 4px white 25 percent, 2.4s, staggered). Reduced motion: none. Do not move the Open map pill.

## KEEP-LIST (must stay, feedCardKeepList.test.tsx stays green)
Per row: thumbnail, name, Class line, Party line, venue, Updated stamp on the right, big distance with "mi" and its slow ping ring, no map pin on rows. Category row (ticket tear). Open map pill, title, ladder chips on the map card.

## Files to read first
src/modules/home-map/HomeMapCard.tsx (teaser card, Open map pill), EventMap.tsx (teaser/maxBounds/fitBounds around lines 160-180, 511-525, 850-880), cards/AllEventsList.tsx (coords, nearMe, hasDistances at about line 292-490), homeMap.css. Do not touch src/components/ui/dialog.tsx or the calendar density files.

## Step 0: INVENTORY.md (before building)
Write INVENTORY.md first: every field, state and option on the live feed and map card (Near me idle, waiting, located, denied, no venues; teaser vs full map), file:line cited, GAPs listed, ending with a coverage count. Handle denied/failed location and fewer than 5 venues without breaking the screen.

## Tests / done
- Unit test in src/modules/home-map/__tests__/: fit picks the 5 nearest and the bounds helper is pure and tested; overlay renders only while waiting; CSS has reduced-motion rule.
- `npm run pre-ship`; CI green on the PR head. No local test runs (pc-heavy-gate): rely on CI.
- Add a "Verified on real data" PR block (read-only prod shapes) and phone screenshots at 390x844 before/after.
- Do NOT merge. Owner previews first.
