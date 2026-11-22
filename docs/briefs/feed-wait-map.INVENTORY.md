# INVENTORY: live feed + map card, Near me (feed-wait-map)

Fields/states on the home feed Near me path and the map card. Lines are at branch head before this change.

| # | Thing | State / option | Where |
|---|---|---|---|
| 1 | Near me chip | idle / tap requests location | cards/AllEventsList.tsx:390 (`geo.request`), HomeChipRow |
| 2 | Geo status | idle, loading (WAIT), granted (located), denied | useGeolocation status type, useMapList.ts:124 |
| 3 | Coords | `state.geo.coords` feeds distances | AllEventsList.tsx:201, :308-313 |
| 4 | Distances | hidden until coords, then shown; `hasDistances` | AllEventsList.tsx:320 |
| 5 | No venues with a place | message when nearest on and no distances | AllEventsList.tsx:442 |
| 6 | Far-from-you note | Clear button | AllEventsList.tsx:437 |
| 7 | Row keep-list | thumbnail, name, Class, Party, venue, Updated, big distance + ping, no pin | cards/cards.tsx, feedCardKeepList.test.tsx |
| 8 | Map card (teaser) | pannable, tap opens map page, minZoom 10, cityBounds | HomeMapCard.tsx (EventMap teaser) |
| 9 | Open map pill, title, ladder chips | homePolish foot strip / legacy chips | HomeMapCard.tsx |
| 10 | Teaser vs full map | full map = CityMap with `userCoords` dot | pages/CityMap.tsx:331 |
| 11 | User dot on card | none before this change (GAP) | EventMap.tsx userCoords effect, unused by card |
| 12 | Wait indicator | none before this change (GAP) | n/a |
| 13 | Card fit to nearest | none before this change (GAP) | n/a |
| 14 | Card pan fence | city bounds only | HomeMapCard.tsx maxBounds |
| 15 | Reduced motion | per-feature opt-outs | homeMap.css |

Handled: denied/idle leave the card untouched (fit only on `granted` + coords); fewer than 5 venues frames fewer; no venues frames the user alone with a minimum span; no coords rows skipped.
Coverage: 15 items listed, 3 GAPs closed here (11, 12, 13), 1 extended (14). Card is pannable, so bounds apply on the card; the full map page is unchanged.
