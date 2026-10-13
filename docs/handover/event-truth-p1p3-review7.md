# REVIEW-7 handover: read-only review of the FIX-7 delta

Scope: `git diff origin/arc/event-truth-p1p3-fix6..origin/arc/event-truth-p1p3-fix7` (14 files), reviewed at
`30ba975b`. Independent reviewer; the author's handover was not trusted, and the diff was read file by file.
No source changed, no CI or build run (read-only brief). Prod reads were SELECT-only (project `stsdtacfauprzrdebmzg`).

No high-severity findings. No regression in Search, chipHint, the removed `created` flag, the memoised
upcoming set or the guard hint. The findings are a mutation gap in the new FIX-7 R3 branch plus two edge cases.

## Findings (most severe first)

```json
[
  {
    "file": "src/modules/organiser/events/EventEditorPage.tsx",
    "line": 184,
    "summary": "The new not-editable Type-row fact (sessionDates over EVERY date) is only tested through the series-programme flag; its per-date branch (added_sessions_count on past dates) has no test, so the mutant `: ws.hasSessions` survives.",
    "failure_scenario": "Mutate line 184 to `!lock && next !== null ? withSessions > 0 : ws.hasSessions`. Every not-editable case in eventTruth.matrix.test.tsx (lapsed, cancelled-only, ended, ended with seriesProgramme:false) uses shapes.ts dates with added_sessions_count: 0 (shapes.ts:252), and editorOrder snapshots use the same shapes, so all stay green. In prod, an ended or lapsed series with no series programme whose past dates carry per-date sessions would then read 'No session on its dates.' / 'Add a session once a date is listed...' instead of 'Set by its sessions.', and no test catches it. Fix: add one ended and one lapsed case with seriesProgramme:false and added_sessions_count:1 on a past, not-cancelled date, expecting 'Set by its sessions.'.",
    "severity": "medium"
  },
  {
    "file": "src/modules/organiser/events/EventEditorPage.tsx",
    "line": 184,
    "summary": "The all-dates count reads ws.dates, which holds only the newest 100 dates (eventModel.ts:31, meta.has_more), so a long series' older per-date sessions are invisible to the not-editable Type row.",
    "failure_scenario": "Ended (locked) series with more than 100 dates, no series programme, and per-date sessions only on dates older than the newest 100: sessionDates(ws.hasSessions, ws.dates) is 0, so the row says 'No session on its dates.' while sessions exist. Prod has 1 series over the cap today (128 dates, event_occurrence_p5). I did not check whether that series has a series programme, which would mask the problem. Either treat ws.hasMore as unknown (do not claim 'No session') or say so in the sentence.",
    "severity": "low"
  },
  {
    "file": "src/modules/organiser/events/eventType.ts",
    "line": 138,
    "summary": "FIX-7 R3 makes hasSession meaningful for a locked event (every date), but the no-stored-word branch still ignores it: locked always reads 'No session, so not set.'",
    "failure_scenario": "Ended series whose only sessions are performances (no genre, so category NULL, the FIX-6 F-c shape): hasSession is true over its dates, but the row says 'No session, so not set.', which is false. Unreachable in prod today: event_series_p5.category is party 709 / class 28 / workshop 6, with 0 NULL. It becomes reachable once a performance-only series ends. The unlocked twin already says 'Its sessions set no type yet...'.",
    "severity": "low"
  },
  {
    "file": "src/modules/organiser/events/__tests__/eventTruth.matrix.test.tsx",
    "line": 68,
    "summary": "expectedSublabel copies typeSublabel's new branches line for line, and the two were changed together in this diff, so the rendered-row cases prove the wiring (which hasSession the editor passes) but not the wording.",
    "failure_scenario": "A wrong sentence change made in both eventType.ts and the oracle (as FIX-7 did, by design) stays green. Only the explicit not.toMatch guards (e.g. line 245, /Set by its sessions|Add a session/) pin behaviour on their own. Prefer literal expected strings per shape over a re-implemented oracle.",
    "severity": "low"
  }
]
```

## What I checked (brief items 1 to 7)

1. **Search Class chip.** `genreFilterTokens` widens only `class` to class+masterclass+workshop; the
   Workshop and Masterclass chips still match only their own word, and the Set dedupes. Prod RPCs
   `search_public_v5`/`v6` filter `es.category = ANY (p_category)` (exact match, confirmed), so there is
   no double count: a row matches once, whatever the chips. Section counts come from the RPC with the
   same filter. `normalizeGenreToken`/`genreLabel`/`GENRE_TOKENS` are unchanged, and `genreFilterTokens`
   has a single caller (SearchResults.tsx:134). The chip active state still reads the raw `ecat`.
   Prod categories are party 709 / class 28 / workshop 6 / masterclass 0. Known and not a regression:
   the Workshop chip alone finds only the 6 legacy rows, because new workshops are stored as `class`
   (the create hint says "listed under Classes").
2. **chipHint across phase, busy and blocked.** I walked all 12 states. Blocked never names Create.
   Made+blocked names "Open the event", and that button renders whenever `made && !busy`, whatever the
   block. Sent+blocked defers to `unconfirmedExitNote`, rendered when `block && sent && !made`.
   Open+blocked keeps "Choose one": the chips are not frozen by a block (`frozen = busy || sent || made`),
   so that control exists and is enabled. Busy states name no control. The table test covers all 12.
3. **Type row and review card.** The review card counts upcoming listed dates
   (`withSessions`, now over `listedUpcoming`, same result since `sessionDates` re-filters cancelled
   dates). The Type row switches to every date only when not editable. They cannot disagree on screen:
   locked means ended/archived (eventLock), where the card is hidden. `NO_SESSION_REASON` needs
   `upcomingListed > 0`, which is the editable case where both read the same count. The empty-state
   sentences name When or Extend, and the locked lock reason names the team.
4. **Removed `created` flag.** On success, `made` is already true and `busy` is still true when
   `navigate` runs, so the guard (`!busy && !made`) was already off. The flag was set synchronously right
   before `navigate`, so it never affected a render before navigation. The Open button only shows when
   `made` is true, so the guard is off there too. No behaviour change.
5. **Memoised upcoming set.** Deps are `[ws.dates, today]` and `[upcoming]`. No early return before the
   hooks, so hook order is stable. Nothing mutates ws.dates in place: `upcomingDates` filters before it
   sorts, the firstDate sort copies, and the useOwnerCommand `setQueryData` spreads and then refetches.
   A save or cancel produces a new parsed `ws`, so there is no stale read.
6. **Guard.** The drift hint is removed from `main`. The #780 text now comes only from the P0-shape
   CANNOT-MEASURE paths (line 297, `added_sessions` missing; line 326, `added_session_count` missing).
   Mutation by reading: re-adding the drift hint makes line 868 return `1:admin #780` instead of
   `1:other` (red); dropping the P0 hint reds lines 864/865 (`2:other`). `pin` reads stderr only, and
   the drift breakdown text (line 471) does not mention #780. Prod's `check_event_truth_v1` does not yet
   have the P3 shape (no `added_session_count` in its definition), so today the guard exits 2 with the
   #780 hint, as intended.
7. **Tests that cannot fail.** See findings 1 and 4. The deleted newEvent.seed "not a copy" test was
   an import-shape check and its loss is harmless. The createHint "longest = 90" test pins real lengths.

## Not verified
- I ran no tests, typecheck, build or CI (the brief is read-only). The claim that the mutants survive or
  die comes from reading the code, not from running them.
- No browser walk.
- I did not check whether prod's 128-date series has a series programme (finding 2).
- I did not read the admin #780 derivation, so the claim that "the server derives `class` for a
  Workshop create" is the brief's word, not something I checked.
