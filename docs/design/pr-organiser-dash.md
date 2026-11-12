# Organiser dashboard slice 1 (admin #1535)

Behind `VITE_ENABLE_ORGANISER_DASH` (default OFF = today's Home). Option A hero + B's date rail.
Code: `src/modules/organiser/p3/dash/` (`dashModel.ts` pure view-model, `DashView.tsx`, `DashHome.tsx` adapter).
Tests: `dash/__tests__/dashScreens.test.tsx`, shape x screen table (new, upcoming, zero, huge, cancelled, selling, contributor, loading, error) plus one test per numbered fix (1-9).

## Omitted on purpose (no read exists; no DB change)
Organiser rating and city average value (city card draws only with 5+ organisers AND a value; the value read does not exist, so never today); opens by source; per-night opens (analytics is per series over the month window, so opens sit on that series' next night only, only when the page has one series and analytics loaded; otherwise unknown, never 0); per-night Going and link-tap-by-type (going read is gated, taps are series totals); Tickets sold (no page-level read wired, `sellingViaUs` is false in the adapter); city organiser count.

## Wired share actions
Share page, Share night and "Tell your group" call `shareText` (native share sheet, then clipboard copy, then a WhatsApp deep link). "Tell your group" also has an "or on WhatsApp" link. The Instagram caption (`captionOf`) is the text handed to the share sheet for a night. A clipboard fallback shows "Link copied. Paste it wherever your group chats."; the notice is cleared at the start of every share, so it cannot outlive a later native share.

Contributor seat: the live `HomeOrganiser.role` is owner|manager only, so contributor is covered by the model and tests, not reachable in the app yet.

## Screenshots
`docs/design/organiser-dash-shots/` (390x844): zero, upcoming, selling, huge, error (re-shot after the review-fixes round) plus new, cancelled, contributor, loading from the first round. All are drawn from a throwaway fixture harness (DashView + buildDash with survey-shaped fixtures), NOT the live app. The `loading` shape is no longer emitted by the adapter (Home is ready without analytics); `contributor` is unreachable live (`HomeOrganiser.role` is owner|manager only). The `error` shot is the analytics-failed degrade (hero + rail + inline retry), not a blank Home.

## Review-fixes round
Opens are a month-window series total: shown as "N opens this month", only for a single-series page once analytics has loaded; otherwise unknown (null), with a neutral "Get people looking at this night" hero. Analytics failure never blanks Home. Add a bio / Add a logo / Add a teammate link to `P3_PATHS.youPage` / `youTeamAdd`.

## Review-fixes round 2
Profile card: with no organiser steps (progress loading, failed, or bio/logo absent) `profile` is null and the card is not drawn, so "Profile complete" only shows when every step is done. Home no longer waits on analytics (`load` is always `ready`; analytics failure still shows the inline retry). Share notice clears at the start of each share.

## Verified / Not verified
Verified: vitest on `dash/` (model table for empty, partial, none-done, complete; slow-analytics Home; notice clearing); the profile and slow-analytics tests fail on the unfixed code.
Not verified: share outcomes on a real phone (native sheet, clipboard, WhatsApp) are exercised only with stubbed `navigator`; no browser walk against live data; no new 390x844 shots for the profile card in loading/partial/complete (no browser walk this round); prod shape survey not re-run. Contributor seat is unreachable live.

