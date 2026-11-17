# Brief: slice 1 copy fix on PR #1748 (branch feat/organiser-slice1-nav)

Owner click 2026-11-17: an event with no coming nights must say "Add a date to this event to use Guest list" (Raffle tab: "...to use Raffle") with a button "Add or edit a night" opening the event's dates screen.

Do exactly this, nothing else (tier S, 2 files):
1. `src/modules/organiser/p3/v2/V2Tabs.tsx`, NightsTab `nights.length === 0` branch: sentence = `Add a date to this event to use ${what === 'guests' ? 'Guest list' : 'Raffle'}.`; Link (same `to`, `to={P3_PATHS.eventDates(c.event!.id)}`) gets `data-testid={`v2-${what}-add-night`}` and text `Add or edit a night`. Keep testId `v2-${what}-nonights`.
2. `src/modules/organiser/p3/v2/__tests__/V2Shell.routes.test.tsx`, in the `it.each` guests/raffle test, before the "Coming soon is ONE card" comment add: when `on && headings === 0`, expect box text to match `Add a date to this event to use Guest list|Raffle` for the tab and `v2-${tab}-add-night` text to be `Add or edit a night`.
Use scripts/safe-edit.py. Run V2Shell.routes.test.tsx and tsc; push to the same branch; done commit marker per dispatch rules.
