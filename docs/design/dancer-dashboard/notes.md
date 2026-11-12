# Dancer dashboard: three options (design only, admin #1533, parent #1531)

Screens: `option-a.html`, `option-b.html`, `option-c.html` (open with `#new`, `#partial`, `#complete`, `#completeEmpty` or `#unclaimed` for one 390x844 frame; no hash shows all five).
PNGs: `option-{a,b,c}-{new,partial,complete,completeEmpty,unclaimed}.png`, all 390x844. Dark dancer theme tokens from `src/modules/dancer-app/theme/dancer.css`.
Inventory and coverage count: `INVENTORY.md`. No app code changed.

Shapes: D1 new account (`new`), D2 unfinished (`partial`), D3 complete (`complete`; `completeEmpty` is the same dancer with zero nights), D4 unclaimed match (`unclaimed`).
Every frame is ONE main card plus exactly 3 items. No views tile, chart, enquiries, saves or weekly summary anywhere.

## Options
- **A. Stacked cards.** Adapts the organiser profile mockup language (see G-5: that file is missing, so it adapts the shipped `Card` + `LinkRow` look). Main card holds the avatar, the 4-step checklist and the single next-step button; the 3 items are a list card. Closest to what ships, lowest build cost.
- **B. One step at a time.** A large greeting, a single-question card ("Step 4 of 4: Add your photo") and a 3-column tile row (matches the density rule). No checklist list: the card names only the next step. Calmest, but the person cannot see the full list.
- **C. The page is the card.** The main card is a live preview of the public page, with the next step under it; complete state shows the page plus Nights attended. Shows the reward for finishing; the preview takes more height and repeats the Me screen.

## Recommendation: A
It keeps the checklist the owner asked for ("shows the next missing step"), reuses components that already exist (`Card`, `LinkRow`, `StrengthBar` words from `api/nextStep.ts`, so the next-step copy stays one mapping), and its complete state is the same card with the checklist removed. B hides the list, C is the costliest to build and duplicates Me. Alternative if the owner wants warmth over information: B.

## Rules shown in all options
- D2: the item "Edit my profile" says "Save stays off until you change something" (the real rule: untouched Save is disabled with a reason and sends nothing, `EditScreen.tsx:434-446`).
- D3: checklist hidden; Nights attended count; at zero it says what to do and offers "Find a night".
- D4: the Claim button says why it is offered ("matched to your confirmed email"). Disabled or unavailable controls carry a reason line (C partial: "Share my page", "Add a photo first").
- Taps: every button, row and tile measured at 44px or more in a Playwright check (0 under 44). No sideways scroll (scrollWidth 390) and no card cut off by the tab bar in any of the 15 frames. Text contrast: white 15:1 and muted #A3A9B3 about 6:1 on the dark surfaces; orange button text #1D0A03 on #F5865A is about 8:1 (computed from the theme tokens, not with a tool; see Not verified).

## Open questions for the owner
1. **Claim button (G-2).** Today claiming is automatic with no click. A button needs either "automatic failed, offer a manual claim" (statuses `ambiguous`, `email_unproven`) or a new decision plus a server RPC.
2. "Nights attended" counts `nights_went` from `my_dancer_stats_v1`; confirm that is what a dancer expects (it excludes going to a night that has not happened).
3. The partner tile, lineup people and rate-a-level nudge leave Home in these designs (G-3). Confirm they move to Nights.

## Verified / Not verified
Verified: inventory read from the code on main @ cdbf2c4 with file:line; prod counts (183 profiles: 169 unclaimed, 11 claimed complete, 3 claimed incomplete, 0 paused); 15 frames rendered in Chromium at 390x844 with zero overflow and zero targets under 44px.
Not verified: admin app dancer-profile screens (repo not attached, G-6); the organiser mockup file (missing, G-5); contrast by an automated tool (computed by hand from tokens); real device (no phone test); no independent reviewer yet; copy not yet reviewed by the owner.
