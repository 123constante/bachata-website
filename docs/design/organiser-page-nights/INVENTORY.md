# Inventory: organiser nights feed swap

Scope-limited inventory (the full page inventory is `docs/organiser-page/INVENTORY.md`). Admin app was not in this sandbox, so admin rows are not listed.

| Item | Where |
|---|---|
| Upcoming feed fetch | src/modules/profile/organiserPublicProfile.ts `fetchOrganiserFutureOccEvents` |
| Past feed fetch | src/modules/profile/organiserPublicProfile.ts `fetchOrganiserPastOccEvents` |
| SSR prefetch of both | app/routes/organiser.tsx (uses the two fetchers above) |
| City per night | `city_name` on OrgOccRow; OrganiserProfile.tsx `buildNightsCardProps`, `buildEventRowProps` |
| Series city label | nightsCardModel.ts `seriesCityLabel`; OrganiserProfile.tsx `upcomingListItems` |
| Cap wording | nightsCardModel.ts `upcomingWording`; OrganiserProfile.tsx NEXT NIGHTS section |
| Dates sheet (city per date) | OrganiserProfile.tsx `SeriesDatesSheet` via `buildEventRowProps` |
| Stats | OrganiserProfile.tsx `organiserStatsByFeed` call (capped upcoming, uncapped past) |
| Cancelled belt | OrganiserProfile.tsx `occ.is_cancelled` guards |

Coverage: 9 of 9 listed items covered by tests (organiserPage.matrix, nightsCityWording, organiserPastWindow, organiser.loader).
