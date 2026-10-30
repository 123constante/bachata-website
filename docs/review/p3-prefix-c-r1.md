# Review r1: PR #1182, P3 prefix C (NULL-rule repeat shape, every break shown)

Independent, read-only review (Fable; the builder was Opus). Branch `claude/p3-prefix-c-repeat-null`
at `d9ad2a7` against `main` at `1dc1660`. Brief: `docs/briefs/review-1182.md`. One round, no fixes
by me. Prod reads on 2026-10-30 (project `stsdtacfauprzrdebmzg`): counts only, `pg_get_functiondef`
of the skip / unskip / move commands, no personal data, no writes.

## Verdict: FIX FIRST

The mapping is one mapping: `repeatShape` / `repeatWords` / `noRuleNote` in `model/repeat.ts`, read
once per workspace by `repeatShapeOf`, and the Repeats row, the read-only sheet and the sheet note
all render from it; no screen keeps its own copy of the words. Every recurring series, whatever its
dates, reads something other than "Doesn't repeat". The new table-driven suite is a real guard:
three behaviour mutants (old words, old break filter, missing `ruleSaved`) are each caught. The
whole P3 tree is green bar one suite that cannot load in this container for an unrelated reason.
Two things need a fix before merge: the PR body's "Verified on real data" block is in a shape the
CI parser rejects (the `real-data-verified` check is red on the head commit), and the wider "every
break shows" change surfaces move and remove tombstones as "Skipped" rows with copy that is wrong
for them. Everything else is low.

## Findings

### Block

None.

### Should-fix (before merge)

**S1. CI `real-data-verified` is red on the head commit.** `.github/workflows` job
`real-data-verified` (run 40999909088) fails the PR body: "Shapes surveyed: line is missing",
"Checks run: empty after the colon", "NOT verified: empty after the colon". The body writes those
three as bold labels followed by nested bullets; the parser wants `- Shapes surveyed: <text>`,
`- Checks run: <text>`, `- NOT verified: <text>` as single lines with text after the colon (the
same class as pr-1130 r1 S2). Severity: medium (a required check). Fix: rewrite the three lines in
the PR body as plain `- Label: text` lines; keep the nested detail below them.

**S2. A move or remove tombstone now shows as a "Skipped" break, with the wrong reason.**
`data/dates.ts:64` lists every `removed_dates` entry as a break. On prod, `_cmd_occurrence_move_date_p5`
appends the FROM date to `removed_dates` (read 2026-10-30), and `_cmd_series_remove_date_p5` appends
a removed added date, so after "Move to Saturday" the old Friday appears under Breaks as "Skipped"
with "Put this week back". With a stored weekly rule that was already true on main (the Friday is
on cadence); the PR extends it to every rule shape and to off-cadence tombstones. Three screens
then say something untrue:
- `model/dates.ts:80` `unskipOffRule` ("The weekly pattern changed since this break") on a stored
  rule for a date that was added then removed, or moved; the pattern did not change.
- `model/dates.ts:107` with no stored rule: "Put this week back" is enabled on a moved-from date
  (the server falls open on NULL, confirmed in `_cmd_series_unskip_date_p5`), and tapping it adds
  the old date back beside the moved one.
- The breaks count and the "Skipped" tag (`dateMarks`) on both the event page and All dates.
Severity: medium (user-facing, real shape: 2 live + 5 ended NULL-rule series and 6 live stored-rule
series carry `removed_dates`; a move is a first-class P3 action). Fix in one line: widen the
off-rule copy to the three causes ("This date was moved, removed, or the pattern changed since,
so it can't come back as a break. Add it as a date instead."), and on a NULL-rule series treat a
tombstone whose weekday is off the dates pattern the same way instead of offering a restore.

### Low

**L1. One moved or added date collapses a weekly NULL-rule series to "loose".**
`model/repeat.ts:314-323` requires every gap to be a multiple of the smallest. A move leaves both the
tombstone and the new date in the set (S2), so gaps of 1 and 6 days give step 1 and the series reads
"No pattern is saved, so each date is set on its own", with Skip greyed on every date
(`noDatesPattern`). The PR body calls this conservative on purpose; the prod survey shows it is
the common case: of 9 live NULL-rule recurring series only 2 infer a pattern (1 weekly, 1
fortnightly); 2 read loose with "step not whole weeks" and dates on more than one weekday, which is
exactly a move's footprint. Fix: infer from the dominant weekday's dates and tolerate a minority of
off-weekday dates (say up to one in four), marking those `ruleDate: false` rather than giving up.

**L2. Skip refusal on a NULL-rule off-cadence date names a pattern that is not saved.**
`model/dates.ts:130` returns `offRule` ("not part of the weekly pattern") when the inferred pattern
says `ruleDate: false`, while the Repeats row one screen up says "No pattern is saved". The server
would accept the skip and the restore (no cadence guard with a NULL rule). Fix: a NULL-rule
variant ("This date is off the weekly run its other dates follow...") or allow the skip.

**L3. Two copies of the loose empty-state fact.** `data/dates.ts:114` hand-rolls "No pattern is
saved and its dates don't follow a weekly one; cancel a date instead" next to
`DATE_WHY.noDatesPattern` (`model/dates.ts:76`), which says the same thing. The pre-existing
`noPattern` line has the same split, so this follows house style, but the brief's "one mapping"
rule says build it from `DATE_WHY`. Fix: `return \`No break weeks. ${DATE_WHY.noDatesPattern}\``
style derivation, or move the empty-state words into the model.

**L4. "Put this week back" is greyed where the server would judge it.** `model/dates.ts:107` greys
a break on a stored monthly or every-2-to-4-weeks rule (`unskipCantCheck`); the server's oracle
(`_compute_series_occurrence_dates_p5_v1`) does judge those within 12 months and would restore an
on-cadence one. Conservative and honest ("can't be checked here"), so acceptable; the fix, if
wanted, is to send and show the server refusal. Note the same page now skips the "Not the usual day"
tag on every-2-to-4-weeks stored rules (`ruleDateOf` returns null for interval > 1), which on main
tagged every date of such a series; that is an improvement.

**L5. `noRuleNote` has a dead branch.** `model/repeat.ts:369-373` returns `REPEAT_COPY.noRule`
("It doesn't repeat yet. Pick the days...") for a one-off or festival, but `repeatAccess` gives
those `mode: 'none'`, so `RepeatSheet.tsx:223` never renders a note for them; the branch exists only
for the matrix column. Fix: return null for `once` and drop that cell, or leave as is.

**L6. Read-only wording hints at a control that is not there.** For an ended NULL-rule series the
Repeats row and the read-only sheet say "going by its dates. No pattern is saved." (13 ended
recurring + 8 ended courses on prod). The sheet's `access.why` says why nothing can change, so no
copy points at a missing control; "No pattern is saved" merely reads like an invitation. Fix
(optional): drop the trailing sentence when `access.mode !== 'edit'`.

## Check results

1. **One mapping x every screen.** Rendered from `repeatWords(repeatShapeOf(ws))`: the Repeats row
   (`EventPage.tsx:217`), the read-only sheet (`RepeatSheet.tsx:208`); `noRuleNote` for the editor
   note (`RepeatSheet.tsx:137,223`). `grep` over `src/modules/organiser/p3` (non-test) finds no other
   "Doesn't repeat", `storedRuleWords` or "No pattern is saved" call site outside `model/repeat.ts`,
   except the empty-state line in L3. Skip and Put this week back read the same shape through
   `ruleDateOf` and `seriesFactsOf.ruleSaved`.
2. **Copy vs controls.** The editor note says "Pick the days", and the day chips are on that sheet.
   The disabled Skip / unskip rows each carry a reason (`DateSheet.tsx:61-66` prints
   `row.reason`). An untouched Repeat save sends nothing (`repeatPlan` returns `[]` on an equal
   draft signature; `repeat.send.test.tsx` keeps that pinned). The misleading reasons are S2 and L2.
3. **Real shapes** (counts, read-only). NULL-rule recurring: 9 live (7 with 2-12 dates, 2 with
   13-100, 3 with cancelled dates, 2 with breaks), 13 ended (5 with breaks, 7 with cancelled), 3
   archived, 1 draft with one date; NULL-rule course: 8 ended (all infer weekly). No NULL-rule series
   has zero dates or over 100; the only over-100 series has a stored rule, and the fixture `over100`
   covers the 100-row cap (pattern inferred from the newest 100). Inferred shape on prod for the 9
   live: 1 weekly, 1 fortnightly, 7 loose (3 gaps not multiples, 2 step not whole weeks, 1 step over
   4 weeks, 1 under 3 dates). Server: skip has no cadence guard; unskip falls open on a NULL rule and
   beyond 12 months; move appends the from-date to `removed_dates`.
4. **Red on unfixed code.** With `origin/main`'s `repeat.ts` swapped in, `repeatNull.matrix.test.ts`
   fails at import (`repeatShape is not a function`), which proves nothing. Behaviour mutants
   instead, run against the branch: (B) `repeatWords` returns the old words for any non-rule shape and
   `noRuleNote` always the old note: 10 fail (8 in the new suite, 2 in `repeat.send`). (C) break list
   filtered by `isRuleDate` again and `ruleDateOf` null with no rule: 12 fail (10 new, 2 in
   `dates.data`). (D) `seriesFactsOf` never sets `ruleSaved`: 2 fail (both `nullLoose` rows). All
   restored afterwards.
5. **Tests run.** `vitest run src/modules/organiser/p3`: 42 files, 2642 tests pass;
   `door.screen.test.tsx` fails to load because `jsqr` is not installed in this container's
   `node_modules` (not the PR). `tsc -p tsconfig.app.json`: 119 errors on both main and the branch,
   the same 5 under `p3`, none in a changed file. `eslint` on the 7 changed source and test files:
   clean. PR checks at `d9ad2a7`: `real-data-verified` red (S1); `phone-qa` red with
   `import.meta.env` undefined in `featureFlags.ts` during SSR, which is red on the last 11 runs of
   that workflow across 7 branches including main merges, so not this PR's; `e2e-smoke` still
   running at review time; everything else green or skipped by path.

## Not checked

- No browser walk at 390x844; the PR body says the same. The newly visible break rows and the
  longer Repeats-row copy ("Every 2 weeks on Friday, going by its dates. No pattern is saved.") were
  not seen on a phone-width screen.
- `e2e-smoke` had not finished when this was written.
- The per-series derived label on the 9 live NULL-rule series was classified by SQL mirroring
  `patternOfDates`, not by rendering each series.
