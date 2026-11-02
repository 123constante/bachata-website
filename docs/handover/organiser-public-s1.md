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
  loader returns the payload **untagged**, so `cacheHeaders` sends browser no-store and
  no edge cache. The comments that relied on the old swallowing are rewritten.
- Tests (RED on main, then green):
  - `src/pages/__tests__/OrganiserProfileFeedError.matrix.test.tsx`: 27 cases for
    {upcoming, past, team} x {data, empty, error}, the events-feed failure case, and
    retry for each feed. On main: **23 failed / 8 passed** (the 8 are the all-ok cases).
  - `app/routes/organiser.loader.test.ts`: uses the real fetchers with a fake rpc. On
    main: **4 failed / 1 passed** (the passing case is all ok).

## Left / next
- S4 (D4, empty box to one line) can now ship: a failure no longer reaches the empty state.
- Not done: a browser walk at 390x844 with an induced RPC failure (see PR "Not verified").
- See the PR body for the per-job check results.
