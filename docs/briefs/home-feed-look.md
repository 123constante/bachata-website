# Brief: home feed look (folder tabs + poster category row + warm rows), behind a flag

Repo: 123constante/bachata-website. Branch off origin/main. ONE branch, ONE PR, bot-authored. Lane: normal (UI only, no DB).

## Inventory first (short, scoped to this change)
Before editing, write `INVENTORY.md` at the repo root of your branch (delete it before the final commit, paste it into the PR body instead): every state of the three areas that the new look must cover, each with file:line on origin/main: tab states (default, selected, focus, hover, Calendar deep-link), map states (loading, error, no events), category row states (All, Near me, one selected, no results for a category, many categories overflowing, location denied/loading/zero nearby), feed row states (poster, no poster, today vs later days, long titles, no price, cancelled/sold out badges). Mark each GAP if the mockup does not show it and say what you chose. End the PR body with a coverage count: "N states listed, N handled".

## Owner-approved design (do not redesign)
Full mockup (open it first): https://claude.ai/artifact/UKmsSaRfRCVk4kjABTAidF (390px wide, All selected left, Party selected right). Earlier feed mockup with row details: https://claude.ai/artifact/JvMPmvqvQJHRJ1FmYuKv7d option C.

1. TOP FOUR TABS = FOLDER TABS joined to the map. Labels unchanged: All Events, Today (flags.homePolish), What's New, Calendar. Each tab: rounded top corners only, 1.5px outline, no bottom border. Selected tab: amber text, amber outline, slightly taller, soft amber glow on top edge, background same as the map panel. The 148px map panel sits directly under the tabs, outlined amber on sides and bottom, bottom corners rounded, no gap between tabs and map. Keep the "Map only" amber chip on the map. Source: `src/modules/home-map/cards/controls.tsx` (TabBar) and `HomeMapCard.tsx`/`HomeMapShell.tsx` where the map is mounted. Keep ARIA tablist, roving tabindex, keyboard, telemetry exactly as is. 44px tap area stays.
2. CATEGORY ROW (the All / Party / Class / Festivals ... filter row, in `cards/AllEventsList.tsx`, homePolish multi filters) = BIG POSTER TEXT: Big Shoulders Display 800, uppercase, 26px, letter-spacing .03em, dim plum (#7d6684) when not selected. Selected: amber text plus a 4px amber underline bar. No boxes, no outlines. One category at a time (tapping selected category returns to All). Row scrolls sideways on one line, next item peeks at the right edge, scrollbar hidden. 44px min height.
3. FEED ROWS (option C): no hero; each event row is a card with 68px poster thumb (poster image, or gradient + start hour as placeholder when no poster), title 15px, venue 13px, meta 13px (type, price), 44px map-pin target on the right. Day header: big amber TONIGHT (Big Shoulders Display 34px) + date + count on one baseline. Meta text 13px floor everywhere. Warmer plum ground.
Palette: ground #2b1630, card #38203f, amber #f5b83d, dim text #b9a6bf. Prefer existing theme tokens where they match; add tokens rather than raw hexes if a token is missing.

## Near me (owner click 2026-11-19, supersedes anything above)
Near me is one more poster word INSIDE the category row, after All: All, Near me, Party, Class, Fest. Tap sorts nearest first and asks for location ONLY on that tap; cards show tilde distances like "~2 mi". With homeFeedLook ON it replaces the separate Near me chip; flag OFF keeps the live homePolish chip row untouched. Data source: the nearMe flag/provider already in prod (#1813, VITE_ENABLE_NEAR_ME, ON): reuse src/lib/geo and the shared GeolocationProvider, do NOT rebuild geolocation. Tap sizes: 44px minimum for tabs, category words, map pins. Mockup: https://claude.ai/artifact/FF4kyEZdgfkDgwVU7LASd8

## Flag
New flag `homeFeedLook` in `src/lib/featureFlags.ts`, env `VITE_ENABLE_HOME_FEED_LOOK === 'true'`, default OFF. OFF = pixel-identical to today. Look at how `homePolish` is wired (HomeMapShell, controls.tsx, AllEventsList.tsx) and follow the same pattern. Decide yourself whether the new look requires homePolish also ON; if so say so in the PR.

## Rules
- Smallest working change. No refactors outside these three areas. No DB, no RPC, no new deps.
- Fonts: Big Shoulders Display is already loaded on the site if used elsewhere; check, reuse, do not add a new font host.
- Checks: `npm run` typecheck/lint/unit as the repo's CI does; offload heavy runs to CI. Add a small test for the category selection (one at a time) if a test file exists nearby.
- 390x844 walk: load the Vercel preview with the flag ON on real data, screenshot All selected and Party selected, attach screenshots to the PR. Measure: tab tap area >= 44px high, category row items >= 44px high, meta text >= 13px, no horizontal page scroll. Fixes go in the same PR.
- PR body: what it does (3 lines), flag name and how to turn it on, what was NOT verified.
