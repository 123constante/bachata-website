# CLAUDE.md -- src/modules/event-page

*Moved from the root CLAUDE.md on 2026-10-02 so it loads only when work
touches this module. The root keeps a one-line pointer here.*

## Event page module

`src/modules/event-page/` is the full event detail surface:
- `buildEventPageModel.ts` — pure model builder from DB payload
- `useEventPageQuery.ts` — React Query hook; calls `event_view_p5` with
  `shape:'snapshot_compat'` (native P5 build; NOT byte-equal to the retired
  `get_event_page_snapshot_v2` -- admin `20260709070000` made it native and
  `20260709080000` revoked anon EXECUTE on the legacy fn. `starts_at`/`ends_at`
  echo `event_occurrence_p5.materialised_start_utc`, a naive London wall clock
  stamped `+00` -- display as-stored, never Intl-convert)
- `BentoPage.tsx` — the ACTUAL top-level render for `/event/:id`, via
  `EventPage.tsx:90`. Owns the `mx-auto w-full max-w-[430px] px-2` wrapper that
  the `--bento-cell` fallback in `src/index.css` is derived from; that coupling
  is guarded by `tests/bentoCellContract.test.ts`.
- `EventPageScreen.tsx` -- DELETED 2026-09-07, along with `sections/EventActionBar.tsx`
  and `useEventPageRsvpMutation.ts`. All three had zero live importers. Do NOT
  restore them from git history to derive layout: the wider
  `max-w-2xl px-3 sm:px-4` shell never rendered the bento, and trusting that
  entry cost a shipped regression (a tablet got a 155.5px bento cell against a
  true 99px).
- `bento/` — bento tile components (schedule, people, raffle, vendor, etc.)
- `sections/` -- MOSTLY DEAD, and unmarked dead code in this module has already
  cost one shipped regression. `EventPageScreen.tsx` was the main importer and
  was deleted 2026-09-07; most files here now have no importer at all. A
  minority are still live, reached from `FestivalDetail.tsx`, `BentoPage.tsx`,
  `JoinGuestListDialog.tsx`, or imported for their types from
  `EventScheduleGrid`. Do NOT assume a file here renders: editing a dead one
  typechecks clean and leaves the tests green while `/event/:id` is completely
  unchanged. No count is pinned here for the same reason none is pinned on the
  check counts -- a number in prose has no writer maintaining it, and three
  instruments disagreed (15 / 21 / 26) the day this was written. Prove the one
  you are about to touch has an importer:
  `grep -rnE "^\s*(import|export)\b.*\bEventInfoSection\b" --include=*.ts --include=*.tsx src`

