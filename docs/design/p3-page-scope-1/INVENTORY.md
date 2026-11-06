# F-26 page scope: INVENTORY (Step 0)

Checked against main at 8c60541 (4 Nov 2026). "Admin app" is NOT readable from this repo
(single-repo session); the admin column is Not verified.

## Data source (read-only, prod stsdtacfauprzrdebmzg)
- Home/Events: `organiser_home_v1` returns ALL the person's pages in one answer (`organisers[].series`). No page argument.
- Stats: `organiser_series_stats_v1(p_series_id uuid, p_from, p_to)` (live `pg_get_functiondef`). No organiser argument; with no series it returns one row per series for the whole team. Each row carries `series_id` but no page id. The client filters to the series ids the chosen page carries in `organiser_home_v1`. No server change needed.
- Shapes (counts): people by pages run: 1 page = 17, 3 pages = 1, 2 pages = 0; series 761, with EMPTY `organiser_ids` 572, run by 2+ pages 6. (Admin count not surveyed.)

## Rows
| # | Where | What it shows | Change |
|---|---|---|---|
| 1 | `p3/data/home.ts` `rowsOf` | every page's events merged | CHANGED: `rowsOf(home, organiserId)` |
| 2 | `p3/data/home.ts` `nextUpView` | looks the row up in every page | CHANGED: scoped lookup |
| 3 | `p3/data/stats.ts` `fetchViewsStats`/`viewsTotal` | all-pages totals | CHANGED: `scopeStats` by series id |
| 4 | `switch/useOrganiserChoice.ts` default | first in server order | CHANGED: first by name; new `useOrganiserChoiceFrom` (old hook keeps its contract) |
| 5 | `screens/HomeScreen.tsx` Next up, Needs you, All your events, views tile ("views of your events") | merged | CHANGED: one page, tile says "this page's events" |
| 6 | `screens/HomeScreen.tsx` empty state | "When you run an event" | CHANGED: says this page, offers Switch |
| 7 | `screens/EventsScreen.tsx` list + empty state | merged | CHANGED |
| 8 | `screens/StatsScreen.tsx` tile "views, all your events", by-event list, chart, table, empty states | merged | CHANGED: one page; loads with home |
| 9 | `screens/parts.tsx` `EventRow` | no multi-page line | CHANGED: "Also run by X" |
| 10 | `screens/PageScope.tsx` (new) | page name + Switch page, in place | NEW |
| 11 | `switch/index.tsx` "Showing" + row list | the chosen page | LEFT: already names the page; shares the rule through `useOrganiserChoice` |
| 12 | `p3/you/YouScreen.tsx` page card, `youRows.ts` "Switch page" | chosen page | LEFT: uses `useOrganiserChoice` (picks up the by-name default) |
| 13 | `screens/GraceBanner.tsx`, `CreateFlow` | read `useOrganiserChoice` | LEFT: contract kept |
| 14 | `screens/EventPage.tsx:290` venue lookup by series id across pages | a series id is global | LEFT: id lookup, not a list; a deep link to an event of the non-chosen page still opens (J5) |
| 15 | `p3/tickets/data.ts:17,29` Tickets sold tile and Get paid prompt on Home | sums all pages | LEFT: not an owned file; flag `organiserTicketing` is OFF. Follow-up |
| 16 | `GoingTile` (`modules/going`) on Home and Stats | all-pages going total | LEFT: separate module, flag OFF on main. Follow-up |
| 17 | `p3/onboarding/PersonFlow.tsx:59`, `OnboardingFlow.tsx:106` first organiser | `?o=` else first | LEFT: gate files, owned by another brief |
| 18 | `p3/you/AddPageScreen.tsx:24` | list of own pages | LEFT: not a scope surface |
| 19 | Old organiser area (`home/useHomeData.ts`, `team/useTeamContext.ts`, `events/EventList.tsx`) | uses `useOrganiserChoice` | LEFT: R1, picks up the by-name default only |
| 20 | Public organiser page | one page by definition | LEFT: nothing to scope |
| 21 | Admin app (what an admin sees per page) | not readable here | NOT VERIFIED |

Coverage: 21 rows found; 10 changed or new (1-10), 10 left as is with a reason (11-20), 1 not verified (21). None silently omitted.

## Acceptance coverage (P x J x S)
Tested in `screens/__tests__/pageScope.matrix.test.tsx` (23 rows). P4, P5, P6 read the same answer and rule as P1-P3 (role changes editing, not which page is read): cannot differ. J5 (deep link) is not a scoped list: cannot change. J6 first visit = by-name default row. J7 = `?o=` row. P8 / chosen id gone = fallback row. Series with empty `organiser_ids`: home decides which page carries it; the client does not guess.
