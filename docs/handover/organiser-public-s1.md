# Handover: organiser public page S1 (error state, not empty state)

Brief: `docs/briefs/organiser-public-s1-error-state.md` on `brief/organiser-public-s1-errors`.
Branch: `claude/organiser-public-s1-errors`. Ticket dt_b948f3204ec5.

## Done
- `src/modules/profile/organiserPublicProfile.ts`: the three feed fetchers throw on an
  RPC error (`throwFeedError`). A real empty result still returns `[]`.
- `src/pages/OrganiserProfile.tsx`:
  - The team roster query throws on error too.
  - Each feed's `isError` and `refetch` are read. `upcomingFailed = events || future`,
    `pastFailed = events || past` (the events feed is the join source for both lists).
  - `FeedErrorLine`: one quiet line, "Couldn&rsquo;t load dates / past dates / the team."
    with a "Try again" button (44px min height, px sizes), shown in place of that section
    only while it has no rows. Past and upcoming fail independently.
  - No empty-state box (`none` / `past-only` / `owner-blank`) while any feed has failed.
    Empty-state wording and layout are unchanged.
  - Found during the work: the legacy base-date fallback would list every series by its
    base date when an occurrence feed failed, hiding the error. It is now skipped while
    either occurrence feed has failed.
- `app/routes/organiser.tsx`: a failed feed is not dehydrated (React Query only
  dehydrates successful queries, and the fetchers now throw). If any feed failed, the
  loader returns the payload **untagged**, so `cacheHeaders` sends `max-age=0, must-revalidate`
  and no edge cache. The comments that relied on the old swallowing are rewritten.
- Tests (RED on main, then green):
  - `src/pages/__tests__/OrganiserProfileFeedError.matrix.test.tsx`: 27 cases for
    {upcoming, past, team} x {data, empty, error}, the events-feed failure case, and
    retry for each feed. On main: **23 failed / 8 passed** (the 8 are the all-ok cases).
  - `app/routes/organiser.loader.test.ts`: uses the real fetchers with a fake rpc. On
    main: **4 failed / 1 passed** (the passing case is all ok).

## Fix round 1 (review `docs/review/pr-1282-r1.md`, ticket dt_98960a8d8d87)
- F1: the hero stats strip HIDES a stat whose feed failed (owner rule: no 0, no dash).
  Upcoming dates hidden while the events or future feed failed; Past nights hidden while
  the events or past feed failed; the third stat hidden while the events feed failed and
  it would be events-derived (no team, no founded year). A team count still shows.
  New matrix assertions: every 27-case row checks the strip, plus "events failed",
  "events failed + healthy team" and "healthy zero". Run against the unfixed page:
  **17 failed / 16 passed**; fixed: 33 passed.
- Brief said "a healthy zero is handled by the existing hide-empty-stat rule". There is
  no such rule in the strip: a healthy zero renders `0` (and no-year organisers show
  `-- Since`). Left unchanged as instructed and pinned by the "healthy zero" test.
  Owner decision if a healthy zero should also hide.
- F2: the loader test imports the route once at module level. Both files together,
  3 runs: 38/38 each time (~5 s).
- F4: comment fixed (`max-age=0, must-revalidate`, not no-store). Comment only.
- F3 left, as briefed.

## Left / next
- S4 (D4, empty box to one line) can now ship: a failure no longer reaches the empty state.
- Not done: a browser walk at 390x844 with an induced RPC failure (see PR "Not verified").
- See the PR body for the per-job check results.
