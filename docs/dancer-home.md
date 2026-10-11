# Dancer home and account routing

Added 2026-10-11. The launch bar for the first dancers is two things: **finish
your profile** and **rate a night**. This page is where a signed-in dancer
lands for both.

## Where the account icon goes: one mapping

`src/lib/accountRouting.ts` is the only place that decides it. Nothing else
may.

- The header's account icon (`GlobalHeader`), the sign-in landing
  (`landingPathAfterAuth`) and every "back to your account" link open
  `ACCOUNT_HOME_PATH` (`/account`).
- `/account` (`src/pages/Account.tsx`) reads `organiser_home_v1` and the
  person's own access requests (the organiser area's own keys and fetchers, so
  `/account/o` then opens from the cache), and asks `accountHome()`:
  - **organiser** (owns or manages one or more), **or an OPEN access request**:
    replaced by `/account/o`, the organiser home. Unchanged.
  - **everyone else**: the dancer home.
  - a URL with a query or hash (an old `/account?...` link): the organiser
    area, exactly as `LegacyAccountRedirect` did before.
  - the organiser read failed: the dancer home, with a line that names the
    organiser area and links to it (a failed read cannot prove anyone is an
    organiser).
- The icon is lit on every `/account*` path (`isAccountPath`).

## The dancer home

`src/components/account/DancerHome.tsx`, inside the lazy `/account` chunk.

- Profile card: photo (or initial), first name, city, dance role. A field the
  completeness fact calls missing reads "not set", even if a cached read says
  otherwise.
- One completeness line, from `completenessFact()` in `lib/profileCompletion.ts`.
  The same function writes the reminder banner and the Finish screen's line,
  and the rating card's gate (`ratingGate`) is the same fact, so the four
  surfaces cannot disagree. Incomplete shows **Finish your profile**
  (`/finish-profile?returnTo=/account`). No dancer row shows the WhatsApp
  contact instead, because the Finish screen has nothing to fill in.
- **My attendance** (`/account/attendance`, `src/pages/MyAttendance.tsx`, routed
  by this change; before it the page existed but had no route). A past night
  links to that event's own rating card (`/event/:id#level-rating`). The card is
  not embedded in the list: importing `LevelRatingPrompt` into a lazy chunk
  splits it out of the `/event/:id` route chunk, which adds one first-load
  request on every event page.
- **Browse parties** (`/city/:slug/parties`).
- **I organise events**: collapsed. Opening it lazy-loads the unchanged
  `OnboardingView` (claim / request access / create) inside `.org-theme`
  (`OrganiserOnboardingPanel.tsx`). A claim, create or request invalidates the
  organiser reads, and `/account` moves the person on to `/account/o`.
- Sign out, with a confirm step.

## Finish your profile -> rate

`/finish-profile` saves only the fields it asked for. An untouched form sends
no command. After a save it refetches `profile-completion`, the same cache
`ProfileCompletionChrome` publishes the rating gate from, and invalidates
`my-dancer-summary`. So `returnTo` (the event page at `#level-rating`) opens
with the tiles live: no reload, no re-login. The server gate
(`rate_series_level_p5_v1` refusing `profile_incomplete`) is unchanged.

The page background: no `bg-background` and no `min-h` on the content wrapper.
`GlobalLayout` paints the fixed page wash. A 70vh opaque block on top of it was
the "black block then purple band".

## Tests

- `src/lib/__tests__/accountRouting.test.tsx`: the mapping table, and the header icon.
- `src/pages/__tests__/AccountDancerHome.matrix.test.tsx`: every prod shape
  (`helpers/dancerBackend.ts`) x dancer home, Finish screen, banner and rating
  card, plus a check that no copy names a control that is not on screen.
- `src/pages/__tests__/FinishProfileToRating.test.tsx`: gated -> finish -> rating live.
- `src/lib/__tests__/navigateTargetsRoutable.test.ts`: links (`to`, `href`,
  `backHref`) as well as `navigate()`; `/profile` and `/onboarding` banned outright.
- `tests/e2e/dancer-home.spec.ts` (in `test:e2e`): 390x844 and 390x600, the
  background seam check, tap targets, both icon destinations.
