# Organiser page nights: design record

Owner decisions 2026-11-05 (brief `docs/briefs/organiser-page-nights-feed-swap.md`). The original design record was not on the brief branch; this is the record of what shipped.

- Feeds: `get_organiser_nights_v2` for both upcoming (`p_include_past:false`, `p_upcoming_limit:20`) and past (`p_include_past:true`, explicit 3650-day window, `p_past_limit:5000`). The server default past limit is 50, which would silently cap "nights hosted", so it is passed explicitly.
- ALL the organiser's nights whatever the city; each night reads `venue, city` (`venueCityLine`). No hard-coded city.
- A repeating event stays ONE row. Spanning cities: first city + "+1 city" (`seriesCityLabel`).
- Cap wording is one mapping, `upcomingWording` in `src/modules/profile/nightsCardModel.ts`: under 20 shows "N dates" and "Show all N dates"; at 20 the heading count is dropped, a single row holding all 20 reads "See next 20 dates", the button reads "Show more nights", and a quiet centred line "Showing the next 20 nights" ends the list.
- Stats: "next night" reads the capped upcoming list; "nights hosted" the uncapped past list.
