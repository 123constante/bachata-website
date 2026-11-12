# Organiser dashboard slice 1 (admin #1535)

Behind `VITE_ENABLE_ORGANISER_DASH` (default OFF = today's Home). Option A hero + B's date rail.
Code: `src/modules/organiser/p3/dash/` (`dashModel.ts` pure view-model, `DashView.tsx`, `DashHome.tsx` adapter).
Tests: `dash/__tests__/dashScreens.test.tsx`, shape x screen table (new, upcoming, zero, huge, cancelled, selling, contributor, loading, error) plus one test per numbered fix (1-9).

## Omitted on purpose (no read exists; no DB change)
Organiser rating and city average value (city card draws only with 5+ organisers AND a value; the value read does not exist, so never today); opens by source; per-night opens (analytics is per series over the month window, so opens sit on that series' next night only, only when the page has one series and analytics loaded); per-night Going and link-tap-by-type (going read is gated, taps are series totals); Tickets sold (no page-level read wired, `sellingViaUs` is false in the adapter); city organiser count; Instagram caption sheet; WhatsApp "Tell your group" (button is drawn, wired to nothing yet).
Contributor seat: the live `HomeOrganiser.role` is owner|manager only, so contributor is covered by the model and tests, not reachable in the app yet.

## Screenshots
`docs/design/organiser-dash-shots/` (390x844): zero, upcoming, selling, huge, error (re-shot after the review-fixes round) plus new, cancelled, contributor, loading from the first round. All are drawn from a throwaway fixture harness (DashView + buildDash with survey-shaped fixtures), NOT the live app. The `loading` shape is never emitted by the adapter on a cold page unless analytics is genuinely loading; `contributor` is unreachable live (`HomeOrganiser.role` is owner|manager only). The `error` shot is the analytics-failed degrade (hero + rail + inline retry), not a blank Home.

## Review-fixes round
Opens are a month-window series total: shown as "N opens this month", only for a single-series page once analytics has loaded; otherwise omitted (null), with a neutral "Get people looking at this night" hero. Analytics failure never blanks Home. Add a bio / Add a logo / Add a teammate link to `P3_PATHS.youPage` / `youTeamAdd`.

## Not verified
No browser walk against the live app with data; no prod shape survey re-run this round; shots are fixture-harness only.
