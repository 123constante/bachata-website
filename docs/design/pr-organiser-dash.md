# Organiser dashboard slice 1 (admin #1535)

Behind `VITE_ENABLE_ORGANISER_DASH` (default OFF = today's Home). Option A hero + B's date rail.
Code: `src/modules/organiser/p3/dash/` (`dashModel.ts` pure view-model, `DashView.tsx`, `DashHome.tsx` adapter).
Tests: `dash/__tests__/dashScreens.test.tsx`, shape x screen table (new, upcoming, zero, huge, cancelled, selling, contributor, loading, error) plus one test per numbered fix (1-9).

## Omitted on purpose (no read exists; no DB change)
Organiser rating and city average value (city card draws only with 5+ organisers AND a value; the value read does not exist, so never today); opens by source; per-night opens (analytics is per series, so opens sit on that series' next night only, and only when the page has one series); per-night Going and link-tap-by-type (going read is gated, taps are series totals); Tickets sold (no page-level read wired, `sellingViaUs` is false in the adapter); city organiser count; Instagram caption sheet; WhatsApp "Tell your group" (button is drawn, wired to nothing yet).
Contributor seat: the live `HomeOrganiser.role` is owner|manager only, so contributor is covered by the model and tests, not reachable in the app yet.

## Not verified
No browser walk or 390x844 screenshots (no running app with data in this session); no prod shape survey re-run; share handlers are not wired.
