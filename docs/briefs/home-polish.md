# Brief: homepage polish + menu sheet (branch claude/home-polish)

Binding source: `~/.claude/plans/DESIGN-REGISTRY.md` row "Public homepage first screen (home-map shell)" (copy in `docs/briefs/home-polish-registry-row.md`). The row beats anything else. Mockups: artifacts in the row. Real tab and row looks win over mockups.

Scope (one PR, behind a flag `homePolish`, default OFF in prod):
1. Chip row replaces existing sort/filter controls (Nearest, Party, Class, Fest; same dot colours). Location spec items all in the row. One shared geolocation provider.
2. Tabs: amber-pill look unchanged; rename Tonight to Today. Distance on rows when located.
3. Header: logo + 44px menu button only. Full-screen sheet with LIST ROWS: search bar, Sign in, Dancers, Teachers, DJs (/djs exists), Organisers, Venues, Raffles (flag), Community, Festivals (Fest filtered list), Cities/countries (location switcher: use the existing city data, no new table). Signed-in: My profile. Organisers: Organiser dashboard, Sell tickets. Footer: theme toggle, Instagram/WhatsApp, Rate us on Google https://g.page/r/Cc1SYPxlRrkmEBE/review , Support us (sheet with 3 buttons: GBP3 https://buy.stripe.com/9B6fZgbh87ft8hicYc9R601 , GBP5 https://buy.stripe.com/28EeVc1Gy8jx1SU4rG9R600 , GBP10 https://buy.stripe.com/eVq7sKad4gQ3gNO4rG9R602 ). Keep bobbing emojis.
4. BottomNav removed site-wide (AppChrome.tsx), only when flag ON.
5. Full-screen search from the menu bar only: recent searches before typing (Clear), chips All/Events/People/Venues after typing; back arrow to menu.
6. Map section Option 3: no heading, chip "N tonight in London" (live count), "26 venues" plus 44px amber "Open map" in strip; map stays 148px.
7. Fixes: tap targets 44px (controls.tsx:104, HomeMapCard.tsx:179, AllEventsList.tsx:302), badges 11px+ (cards.tsx:219,312-316,524), palette drift to tokens, Sign in contrast, a11y (dialog, focus, back one level), end-of-feed link block (Organisers, Venues, Raffles), states (location denied, zero results, per-role menu).
Density exclusions in CLAUDE.md apply. Use explicit px for tap targets.
Done = 390x844 walk on prod-shaped data, "Verified on real data" PR block, pre-ship green.
