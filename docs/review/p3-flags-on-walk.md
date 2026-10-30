# P3 walk with all three flags on (read-only audit)

Date: 2026-10-30. Branch `claude/walk-p3-flags-on-audit` from `main` @ `1dc1660`. Docs only; no `src` edits.

## How it was run

- Flags in the dev server: `VITE_ENABLE_ORGANISER_P3=true`, `VITE_ENABLE_ORGANISER_SELF_SERVE=true`,
  `VITE_ENABLE_ORGANISER_TICKETING=true`, with `VITE_SUPABASE_URL=https://walkfake.supabase.co` (per
  `docs/handovers/p3-golive-wiring.md`, so nothing can reach prod).
- Playwright chromium at **390x844**, light theme. Every auth and REST call answered by the existing
  route-mocked `OrganiserFake` (`tests/e2e/helpers/organiserFake.ts`); the Go live screens also got the
  `walk-p3-golive.spec.ts` mocks (status draft, complete, RPC answers `live`). A throwaway spec (not committed)
  visited 31 screen states and measured each one in the page.
- Signed-in state is the fake's injected session. **The sandbox cannot sign in to the real site**, so this is
  NOT a real-data walk: every screen saw fake data, and RPCs the fake does not know (ticketing, profile
  progress, role intent, dancer wizard) were answered with `[]`. Findings that come only from that are marked
  *mock gap*. No Supabase query was run; no prod write of any kind.
- Measures per screen: renders vs NotFound/redirect, document sideways scroll, visible tap targets under 44px
  (height or width), text whose colour vs its effective background is under 4.5:1, console errors, a way back.
  "Copy pointing at a missing control" and dead ends were checked by reading each screen's text and control list.

## Per screen

Tab bar (Home / Events / Stats / You) present on every tabbed screen. "Footer" = the public site footer
(Parties, Classes, ... FAQ, Monday..Sunday) that renders under every P3 screen: 20 links, 14px tall each.
Contrast: no P3 text measured under 4.5:1 on any screen (light theme only; dark not measured).
Sideways scroll: 0px on every screen. NotFound: none.

| # | Screen (path) | Renders | Taps < 44px inside P3 (excl. footer) | Console errors (excl. the dev-only SSR `nonce` hydration warning on every page) | Way back | Notes |
|---|---|---|---|---|---|---|
| 1 | Welcome, no page (`/start`, noOrganiser) | yes: "Find your page" | none | `parseWizardDancer` "Your profile did not load", `malformed_answer` x2 (*mock gap*) | Not you? / tab-less, no back | First run crashed "Invalid hook call"; did NOT reproduce on rerun (Vite dep re-optimisation in the cold dev server) |
| 2 | Home, no page (`/account/p3`) | redirects to `/you/add` "Find your page / Create a new page / Just here to dance? Browse events" | none | none | tab bar | ok |
| 3 | Start, has page (`/start?o=`) | "Welcome to Ritmo Bachata London" 0% | none | same 3 *mock gap* errors | Not you? | ok |
| 4 | Go live Review (`at=review`) | "100% All set ... Go live" | none | same | yes | ok |
| 5 | Go live tapped | "You're live ... View my page / Go to Home" | none | same | Go to Home | ok; View my page -> `/you/page` (organiserDetail off) |
| 6 | Home | yes | Continue / Hide for today ok | none | tab bar | **Grace banner "Finish your details ... 0 things left"** (see D3); "Continue" label sits high in its button |
| 7 | Events | yes, 2 events | none | none | tab bar | ok |
| 8 | Event page | yes | none | none | "All events" | Tickets row, "Scan tickets - At the door" row present |
| 9 | Session sheet (tap a session) | yes | **Close 38x44**; field labels 20px tall (inputs themselves ok) | none | Close | |
| 10 | Add session sheet | yes | **Close 38x44** | none | Close | |
| 11 | Repeat sheet | yes, Every week/month, days, "Stops on a date", save disabled "Nothing changed yet" | none | none | Close | ok |
| 12 | Status sheet ("Live - Hide or end it") | yes | **Close 38x44** | none | Close | |
| 13 | All dates | yes, Coming 12 | none | none | "Friday Bachata" | ok |
| 14 | Name and details | yes | p3-d-cover 356x**42** | `progress_bad_shape` (*mock gap*) | Back | |
| 15 | Prices | yes | **"It's free" switch 22x22** | `progress_bad_shape` (*mock gap*) | Back | |
| 16 | History | yes, empty "Nothing has changed yet ... Back to the event" | none | none | yes | ok |
| 17 | Door, direct URL | **first run: blank** (see D2); after fix: "CANNOT CHECK TICKETS - You're not on this event's team" for the OWNER (see D1) | none | 500 on `door/camera.ts` (first run) | "Event" link | |
| 18 | Door via "Scan tickets" tap | same as 17 | | | | tap reaches the route |
| 19 | Stats | yes, "No views yet" | none | none | tab bar | ok |
| 20 | You | yes, Get paid row "Not connected", Organiser page, Team ... | none | `progress_bad_shape` (*mock gap*) | tab bar | |
| 21 | You > Organiser page | yes | **Edit city / Edit year started / Edit category 32x44** | `progress_bad_shape` | back chevron | |
| 22 | You > Team | yes, "Wants to join" request | none | none | back | ok |
| 23 | You > Team > Add someone | yes | none | none | back | ok |
| 24 | You > Team > a non-member id | "They are not on the team any more. Back to the team" | **Back to the team 314x40** | none | yes | |
| 25 | You > Hand over | yes, one candidate | none | none | back | ok |
| 26 | You > Switch page | yes | none | none | back | ok |
| 27 | You > Add a page | yes | none | none | back | ok |
| 28 | You > Your details (`/you/details?o=`) | **"We couldn't load your details. Try again"** (*mock gap*: wizard dancer read got `[]`) | none | same 3 | Try again only | could not see the real form |
| 29 | You > Welcome (`/you/welcome?o=`) | yes, "Add an event / Look around first" | none | none | yes | ok |
| 30 | You > Get paid (tickets) | yes, "Connect payments ... You leave Bachata Calendar..." | none | none | "You" | ok |
| 31 | `/you/done` with no state | redirects to `/you` | | | | ok |

Copy pointing at a control that is not on screen: none found in the text read. Dead ends: none found; the only
screens with a single exit are the error states (28, door not_allowed) and they do have one.

## Not reached / not verified

- **Real sign-in and real data**: impossible from this sandbox; every shape is the fake's. The *mock gap* rows
  (Your details form, the ticketing door list and Tickets entry with real orders) were not seen in their loaded state.
- Door camera scanning, a real check-in, and the Tonight's list with rows (fake has no `ticket_door_list_v1`).
- Ticket type sheet / ticket orders from the event page Tickets row (not tapped into).
- Dark theme contrast, 360x640 / 320x568, 130% text, real-device keyboard.
- The P3 onboarding page steps between Welcome and Review (covered by `walk-p3-w4b2-page.spec.ts`, not re-walked).

## Ranked defects an owner would hit on a phone

1. **D1 (high) - Door says "You're not on this event's team" to the owner whenever the list answer is not
   exactly `result:'ok'`.** `src/modules/organiser/p3/door/data.ts:53` maps every other value (null, `[]`, a
   new server shape, a partial answer) to `not_allowed`, which renders a grey "CANNOT CHECK TICKETS" card with
   no retry and advice to "ask the event's organiser to add you". Seen with the owner fake. At the door this
   reads as a permissions problem when it is a load problem; it should be an error with Try again, and only an
   explicit `not_allowed` should show that card.
2. **D2 (high, conditional) - A failed lazy chunk on the Door gives a blank screen with no way back.** In the
   sandbox `jsqr` (pinned in `package.json`) was missing from `node_modules`, `door/camera.ts` 500'd, and the
   route rendered nothing at all (no header, no back link, `Suspense fallback={null}`). Root cause here is a
   stale sandbox install, but the same blank happens on a phone if the door chunk fails to load on bad venue
   signal. Confirm an error boundary with a back link wraps the P3 lazy routes.
3. **D3 (medium) - Home grace banner can say "Finish your details ... 0 things left".** `graceShown` only checks
   `!complete`; the count comes from `missing`. Seen when the status read was malformed (*mock gap*), but any
   `complete:false, missing:[]` answer shows a nag with nothing to do and a Continue that leads nowhere specific.
   Hide the banner (or say "Checking...") when `left === 0`.
4. **D4 (medium) - Tap targets under 44px in P3**: sheet **Close 38x44** (session, add session, status sheets);
   Prices **"It's free" switch 22x22**; Organiser page **Edit city / year / category 32x44**; Team person
   **"Back to the team" 314x40**; Details cover row 42px.
5. **D5 (low) - Public site footer under every P3 screen**: ~20 links at 14px tall (Parties ... Sunday,
   Privacy, Terms) below the P3 content; reachable by scrolling past the tab bar's content.
6. **D6 (low, visual)** - Home grace banner "Continue" label is not vertically centred in its button.
7. **D7 (low, dev only)** - every page logs React "Extra attributes from the server: nonce"; and a cold dev
   server's first load of `/start` once crashed with "Invalid hook call" (not reproduced). Neither is expected
   in the production build; listed so nobody chases them as P3 bugs.

Mock gaps to close in `OrganiserFake` before the next walk: `ticket_door_list_v1`, `ticket_check_in_v1`,
profile progress, role intent / role details, and the wizard dancer read, so screens 14-15, 20-21 and 28 can
be seen in their loaded state.
