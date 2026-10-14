# Handover: event-creation W3 (Website) &mdash; lists, Past section, one vocabulary, Type row removed

Branch `claude/event-creation-w3` (from `main` at 4a63921, after #750). PR #757 (opened by the bot). Brief:
`briefs/event-creation-w3.md` on `arc/briefs-event-creation`.

## What changed

- **New `src/modules/organiser/shared/lifeLabel.ts`, `seriesLife(series, upcomingCount)`.** This is the ONE
  mapping for a series' life on organiser screens. It decides the status tag, which Events-list section the
  series sits in (`current` or `past`) and the row note. It only changes what is shown: stored
  `lifecycle_status` is never written and no job runs (d31).
  - ended / archived &rarr; Past, keeps its own word (Ended / Archived).
  - **live** with 0 upcoming dates: recurring &rarr; "Nothing coming up" plus the note "Open it to see how to
    add dates."; one-off, course, festival or null format &rarr; "Finished". Both are neutral tone and go
    under Past.
  - Everything else (draft, in review, changes needed, paused, live with dates) stays current with its own
    lifecycle word. A paused or draft series with no dates is NOT relabelled: the organiser still has a
    step to take there.
  - "Upcoming" means any date from London today on, **cancelled dates included**. That is the same set
    `organiser_home_v1.upcoming_count` counts (read with `pg_get_functiondef`, SELECT only) and the same
    set `upcomingDates()` returns in the editor. The workspace returns the newest 100 dates, so a series
    over 100 dates still carries its upcoming ones.
- **`EventList.tsx`.** Current rows come first, under "Your events". After them is a collapsed
  **Past (n)** heading: a 44px button inside an h2, with `aria-expanded`. Past events are never hidden, and
  the row that is open in the editor beside the list is never folded away. If every event is past, the
  current section shows an empty state saying what the person can do. Row tag and note both come from
  `seriesLife`. The note wraps instead of truncating; the 390px walk caught it being cut off.
- **`EventEditorPage.tsx`, Type-row hunks only** (tell W2):
  1. imports: `Shapes` icon, `categoryLabelFor`, `typeSublabel`, `lifecycleTag` removed; `seriesLife` added;
  2. `const tag = seriesLife(ws.series, upcomingDates(ws.dates, today).length).tag;` (was `lifecycleTag(...)`);
  3. the `typeHasSession` computation and its comment removed, plus the "and the Type row" comment wording at `withSessions`;
  4. the `<Card>` holding `<SummaryRow label="Type" … testId="org-row-type">` removed (d39).
- **`eventType.ts`.** `TypeRowState`, `typeSublabel` and `noDateSentence` are removed, along with the
  now-unused `wordForStored` import. `EVERY_UPCOMING_CANCELLED` stays because the Schedule card uses it.
  The chip table and `chipHint` (W1's) are untouched.
- **`endedRun.ts` is unchanged.** `runNoun` already reads `wordForStored`, and a stored workshop already
  reads "class". After the Type row went, no organiser copy names a type word, so d45 ("Party" on
  organiser screens) has nothing left to map. I did not add an unused organiser word map; the
  eventTruth matrix asserts no editor shape shows "Night" or "workshop". If W2's sessions copy ever
  needs a type word, add the map in `lifeLabel.ts`, over `wordForStored` with `night` &rarr; "Party".
- **`src/lib/eventCategory.ts` is byte-identical** (`git diff origin/main` is empty). No calendar
  density-excluded file was touched.

## New logic (one line each)

- `seriesLife`: closed &rarr; past/own word; live &amp; 0 upcoming &rarr; past and Nothing coming up (recurring, plus a note) or Finished; else current/own word.
- `EventList`: `showPast = pastOpen || past contains activeId`.
- Editor tag: `seriesLife(ws.series, upcomingDates(ws.dates, today).length)`.

## Checks

| Check | Result |
|---|---|
| New `lifeLabel.matrix.test.tsx`: 105 pure rows (7 statuses x 5 formats x 0/1/120 upcoming) + every shape (25 F4 + 15 prod live-only-past + 1 over-100-all-past) x {list row tag, section, note, editor tag} + one-list order/count + active past row | 148 pass |
| Red-first on base `main`, with only `lifeLabel.ts` and the test copied in | 43 of 148 fail (every screen row) |
| Mutants (one per rule): M1 recurring reads Finished, M2 no live check, M3 lapsed stays current, M4 closed reads current, M5 no note, M6 list row stored tag, M7 Past open by default, M8 active past row folded, M9 editor tag stored word, M10 list counts next_dates only | all 10 killed (1 to 37 failures each) |
| `src/modules/organiser` unit tests | 82 files, all pass |
| eslint on changed files, `tsc` on organiser files | clean (pre-existing `TeamPicker.test.tsx` tsc error is on main too) |
| `AUDIT_STRICT=1 npm run check:images` | pass |
| CI steps (every pull_request workflow, run locally) | see the PR body / session report |
| Browser walk, PRODUCTION build (`playwright.build.config.ts` server, `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, organiser fake with the prod shapes) at 390x844 | 2/2 pass; screenshots in `docs/screenshots/event-creation-w3/` |

## Verified

- Prod survey (read-only, counts only, 2026-10-14). 15 live series have no date from today on: 7 one-off
  (1 past date each), 2 course (4 and 5 past), 1 festival (1 past), and 5 recurring (2, 3, 6, 8 with a
  rule, 17 past; 0 to 8 cancelled). All 15 are fixtures in the matrix, and none reads "Live".
- 390x844 walk on the production build: Past collapsed (count 5), expanded, Finished and Nothing coming up
  rows, the note wrapping, no horizontal scroll, the editor tag for both words, no Type row, and the
  "only past events" empty state.

## Not verified

- No walk against the REAL prod RPCs (the fake serves prod-shaped data). Ricky's phone test is still the final check.
- 360x640 not walked; only 390x844 was.
- The Home screen and the date page still use `dateTag` (the series word or Cancelled) on dated rows. Home
  lists only upcoming dates, so a lapsed series never shows there. The date page for a PAST date of a
  lapsed series still says "Live"; that is outside this slice's files and is queued as a follow-up.
- A series whose every upcoming date is cancelled counts as current ("Live"), matching `upcoming_count`.
  The owner may want it to read "Nothing coming up" too; that is not decided.
- The walk spec was run from a scratch worktree and is not committed: its screenshot path is absolute,
  and the `e2e-build` dir is a CI suite.
