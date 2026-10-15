# Brief: Dancer Rebuild W2b, Home (`/app/home`) + Nights (`/app/nights`) -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC). Model Sonnet 5.5. NEVER run `gh api` in this repo; read
other branches with `git fetch origin <branch>` + `git show FETCH_HEAD:<path>`. Read
`briefs/dancer-rebuild-COMMON.md`, `briefs/dancer-rebuild-INTERFACE.md` and `briefs/dancer-rebuild-W2-SHARED.md`
on `arc/briefs-dancer-rebuild` FIRST, then the plan change table rows C22, C25, section 1 decision 7, D10,
Appendix A rows 7, 8, 10. BRANCH: `arc/dancer-app-w2b`, created FROM `claude/dancer-app-r1a` (SHA in the
dispatch prompt). Push only this branch. Do NOT open a PR. Siblings W2a/W2c/W2d/W2e own their own
`screens/` folders; W1's shared files are FROZEN (deviations go in the handover).

## Files you OWN
`src/modules/dancer-app/screens/home/**`, `src/modules/dancer-app/screens/nights/**`,
`tests/e2e/dancer-app/home-nights.spec.ts`, `docs/handover/dancer-rebuild-w2b.md`.

## Home (mockup "3 Home")
- Greeting row (photo circle, "Good evening", first name).
- Next-night hero card (plum-to-coral gradient): the next upcoming occurrence the person is Going to or
  Interested in, read through the EXISTING attendance read `get_my_event_attendance_v2` (via a thin
  wrapper you add in your folder that calls `rpcLoose`; the same shape `MyAttendance.tsx` consumes; read
  that file on `origin/main` for the row shape and keep ONE mapper). "See event" opens the normal event
  page (leaves the app). No upcoming night: the card says so and offers "Browse what's on".
- Tiles (2x2): Profile strength (ring, `strength.pct`, `next_step` copy, taps to Me); Views this month
  (release 1a: NOT available, the tile shows "Coming soon" dashed, never a fake number); Going / Interested
  count with "Next: <date>" (taps to Nights); Practice partners dashed "Coming soon" (the "tell me when
  ready" button is release 1b: render the tile without a button and say "Coming soon").
- Stats strip (release 2): render NOTHING in 1a (no dashed placeholders with numbers).
- "What's on this week" card: 3 upcoming events in the person's city from the public events read the
  calendar already uses (find the hook the city calendar page uses on `origin/main` and reuse it; never
  a new query), each row opening the normal event page; "Browse all events" link to the city calendar.
- Level-vote nudge (D10, C22): ONE card "Rate last night's event" shown only when there is a PAST
  occurrence the person was Going to within the last 7 days whose series the person has not rated;
  taps to Nights with that night focused. Uses `useSeriesLevelRating` + `levelRatingModel.ts` (read-only
  reuse; never a copy).
- Linked-profile notice card (D1) on the FIRST Home visit when `linked_from_admin` (dismiss stored in
  localStorage with try/catch; never for signed-out).
- Every state of today's `DancerHome` kept (Appendix A row 7): no profile -> message-us copy; incomplete ->
  the strength tile says what to add; paused (`is_active=false`) -> a banner "Your profile is hidden" with
  a link to today's `/account/settings` (release 1a keeps that screen); organiser-type people never reach
  here (W1's gate).
- Funnel: `dancer_app_entered` once per session on first Home render.

## Nights (mockup "4 Nights")
- Upcoming list (Going / Interested pills) and Past list, both from the same attendance read, one mapper.
- Past nights carry the level vote inline: "What level was it?" with the three EXISTING answers
  (Mostly beginners / Mixed / Strong) through `useSeriesLevelRating(seriesId)`; after answering "You said:
  Mixed"; one vote per SERIES (a second vote replaces the first, exactly as the event page does); the
  server gate `profile_incomplete` is shown as the same copy the event page uses; an incomplete profile's
  vote is HELD via `pendingLevelRating.ts` and replays after onboarding (test it with the fake backend
  flipping `complete`).
- Empty states: "You're not going to anything yet. Browse what's on" (link); past empty: "Your past nights
  will appear here".
- `/account/attendance` stays untouched and keeps working.

## Tests (table-driven; red-first for bug-shaped ones)
Shapes: no attendance; one upcoming Going; one Interested; one past unrated; one past rated; past within
7 days unrated (nudge) vs 8 days (no nudge); incomplete profile (vote held); paused; linked-from-admin
first visit vs dismissed; no city (what's-on hidden with a hint to set the city). Assert: the same night
reads the same on Home and Nights (one mapper); every empty state names a control that exists; no fake
numbers; the vote replaces, never duplicates; the nudge disappears after voting. Red-first: a mutant
rendering "12 views" must red; a mutant keying the vote per occurrence instead of per series must red.

## Gates
Unit (Node 22), lint, typecheck, `npm run build`, Playwright spec (or NOT RUN + reason), isolation
check, `npm run pre-ship`, every applicable workflow job. 390x844 screenshots of Home and Nights on at
least four shapes under `docs/handover/dancer-rebuild-w2b/`.

## Failures this brief exists to prevent
A second attendance mapper; a fake stat; a vote keyed per occurrence; a nudge that never clears;
`MyAttendance.tsx` or any level-rating file edited; a signed-out analytics event.

## Done means
Everything above + handover. Commit, push ONCE with `[worker-done <ticket>]`. Stop after the push.
