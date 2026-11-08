# INVENTORY: Details hints for festivals and videos

Admin app (`bachata-admin-11april`) is not attached to this session, so its column is marked NOT READ; nothing is claimed from it.

| # | Item | Admin app | Website now | Public page |
|---|---|---|---|---|
| 1 | Kind card hint, non-festival kinds (weekly, monthly, custom, course, one-off, draft) | NOT READ | `labels.ts:266` `detailsKindHint`; rendered `DetailsScreen.tsx:200` | n/a |
| 2 | Kind card hint, festival | NOT READ | same line 200 (wrong: sessions are read-only) | n/a |
| 3 | Festival sessions are read-only, ask the team | NOT READ | `labels.ts:211` `festivalAsk`, `programme.ts:48` | n/a |
| 4 | Kind shape (`kindOf`) | NOT READ | `model/kind.ts:8` | n/a |
| 5 | Videos textarea, one link per line | NOT READ | `DetailsScreen.tsx:189-191` | n/a |
| 6 | Videos hint | NOT READ | `labels.ts:259` `detailsVideosHint` | n/a |
| 7 | Videos parsing (`videoList`), max count, bad link problem | NOT READ | `data/details.ts:59,112-115`; `labels.ts:260` | n/a |
| 8 | Videos save payload `default_video_urls` | NOT READ | `data/details.ts:177` (unchanged) | n/a |
| 9 | Only first playable link is shown | NOT READ | n/a | `lib/parseVenueVideoUrl.ts:112` `pickPlayableVideo`; used `BentoPage.tsx:316`, `FestivalDetail.tsx:2571` |
| 10 | Videos states: 0, 1, 2+, 2+ non-playable, over max, locked (disabled) | NOT READ | `DetailsScreen.tsx:190` `disabled={off}` | n/a |

Coverage: 10 of 10 website/public items covered; admin column 0 of 10 read (not attached).
