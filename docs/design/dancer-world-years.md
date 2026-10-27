# Dancer world: "N years dancing"

- **What:** one muted line, "N years dancing" ("1 year dancing" singular), on the dancer world card. No Level, no Veteran / Experienced label (owner, 2026-10-25).
- **Where:** `/dancers/:id` with `flags.personWorlds` ON, inside the card directly under the sub line (role &middot; city), or under the name when there is no sub line. `data-testid="dancer-world-years"`.
- **Why:** the flag-ON world dropped the "Dancing N years" fact prod shows today; this must land before the flag flips (no flag flipped here).
- **Token:** `WORLD.dancer.card.muted` (`../tokens`), 15px explicit, `mt-1`: identical to the sub line. No new box, no new colour.
- **Shapes (prod, read-only 2026-10-25):** no start year 154 of 173 (no line, no gap); this year (0) 2 (no line); 1 year 3; 2-7 years 3; 8+ years 11; future 0; before 1960 0. The card skeleton (`CARD_SKELETON_PX = 233`) stays sized for the common no-years card; a years card is one 15px line (~22px) taller.
