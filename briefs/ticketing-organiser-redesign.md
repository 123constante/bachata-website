# Brief: S3b organiser ticketing redesign (owner picked Option B, Compact)

Branch: continue `claude/ticketing-organiser-ui` (PR #1060). Lane: normal (Website only, no migration, no `supabase/**`). Flag stays `organiserTicketing`, OFF. Model: Opus.

## Why
Owner: "I need it as intuitive as possible and ui and ux at a high standard." S3 as built (4 plain screens) is functionally right but not intuitive. Owner saw two mockups and picked **B (Compact)**. Mockup: https://claude.ai/artifact/7NicJi37hDk21cUSG239ZD (read the B rows). Keep everything S3 already does correctly (roles, locked-price rule, no-op save sends nothing, error states, Stripe-not-set-up, whole-order refund). Change presentation and flow only. No change to ticketsApi contracts.

## What to build (six screens, 390x844, dark organiser area, existing tokens only)
1. **Home, first open (payments not connected):** header "Tickets". ONE highlighted "Next step" card: "Connect payments to sell <event>", line "Stripe pays you directly. About 10 minutes, once.", full-width primary button "Connect payments". Under it a 3-segment setup progress ("Setup 1 of 3 done": payments connected, first ticket added, on sale). Then the organiser's events as compact cards (name, date, chip "No tickets"). If payments are not switched on server side, say so in plain words, no dead button.
2. **Home, payments connected:** chip "Paid out via Stripe"; two number cards Sold and Sales (GBP); events list with chip Selling / No tickets and "8 left of 20"; an event with no tickets gets a highlighted card with a primary "Add tickets". The Next step card appears only while something is left to do.
3. **Add a ticket = three short steps** (sheet with progress bar, "1 / 3"): step 1 Name + Price only, with a live "Buyer pays" box (ticket price + 50p booking fee = total; free ticket shows "Free, no fee"); step 2 places (capacity) and when sales open and close with plain defaults (Now / Event start); step 3 Review in plain words with sticky bottom buttons "Put on sale" and "Save as draft". Back keeps entered values. Sticky action bar clears the safe area.
4. **Review step** as above, shows price, places, on sale, closes, buyer total.
5. **One event:** each ticket type is one row: name, "12 sold · 8 left", and a **Selling switch** (replaces Pause / Put on sale buttons; label states the state). Orders below, each shows the **buyer's name**, "2 × £10.50 · today", and a Refund control for owners/managers only. Editing a ticket reuses the three-step sheet (locked fields say why).
6. **Refund sheet:** title "Refund <buyer name>?"; body "£21.00 goes back, booking fee included. Their N tickets stop working and the places reopen. Cannot be undone."; destructive primary "Refund £21.00", secondary "Keep the order".

## Rules
- Every `<SheetView>` keeps `returnFocusRef` (focusReturn.test.tsx); update its expected file list if you add sheet files.
- Taps >= 44px (use explicit px; html font-size is ~13.5px on phones), contrast >= 4.5, no sideways scroll, every empty/loading/error state offers an action.
- No Unicode punctuation in source (use `&mdash;`, `&pound;`, `&middot;`, `&times;`). Files over 2 KB: use scripts/safe-edit.py / safe-write.py as the hook prints.
- Buyer total maths comes from one shared helper (ticketModel), not copied per screen. Table-driven tests: every screen x every shape (no payments, payments pending, connected, no tickets, selling, paused, sold out, free ticket, contributor read-only, API error).
- Buyer name comes from the existing orders data; if the API does not return it, show "Buyer" and add it to the handover as a follow-up for the data owner (do not change edge functions).
- Design record `docs/design/1060.md` linking the chosen mockup; run the Design Gate stage 4 self-checks and list results.
- Update PR #1060 body: keep the exact `## Verified on real data` labels (`Shapes surveyed:`, `Checks run:`, `NOT verified:`) and `## Phone QA` labels (`Sizes checked:`, `Walked:`, `Not verified:`).
- Early checkpoint push, then push + handover (docs/handover/ticketing-organiser-ui.md) before stopping. Never merge or approve.
