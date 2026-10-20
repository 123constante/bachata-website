# Brief: independent READ-ONLY review of Website PR #757 at head a5157e5 (you did not write it)

Repo `123constante/bachata-website`, branch `claude/event-creation-w3`, PR #757 (head `a5157e5`). You change NO code and push NO branch except one empty
commit `claude/done-<ticket>` (see the dispatch prompt). Read with plain git (`git fetch origin claude/event-creation-w3`, `git diff origin/main...FETCH_HEAD`), never `gh api`.
No shell variables or loops where a plain command works.

## What the PR does (owner decisions d31 / d39 / d45, display only, no migration)
One shared `seriesLife()` (`src/modules/organiser/shared/lifeLabel.ts`) drives the status tag, the Events-list section and the row note: a live series with no
date from London today on reads Finished (one-off/course/festival) or Nothing coming up (recurring); ended/archived go to a collapsed "Past (n)" section; the
Type row is removed from the organiser editor. Fix pass (a5157e5): the Past toggle opens once from the active event then can collapse; the date page's tag
reads `seriesLife`. Decided, NOT to be changed: a live series whose upcoming dates are all cancelled stays "Live".

## Review for correctness only (high-confidence findings, no style)
1. Every place the series' status word is shown to an organiser (grep `lifecycleTag`, `dateTag`, `lifeLabel`, `seriesLife`, `StatusTag`): does any screen still
   read a second mapping so the same fact reads two words? List each screen and the source.
2. `EventList.tsx` render-time state adjustment (`seenActive`/`pastOpen`): any loop, stale state, hook-order violation, or a case (active id changes,
   home refetch, series list shrinks) where the open event's row is hidden or the toggle misreports `aria-expanded`.
3. Date page: `upcomingDates(ed.workspace.data?.dates ?? [], today)`: the workspace lists the NEWEST 100 dates. A series over 100 dates that is live with
   upcoming dates: confirm "Live". A lapsed series (all dates past, > 100 dates): confirm "Finished"/"Nothing coming up". Loading state: no wrong flash.
4. Removed Type row and `typeSublabel`/`TypeRowState`: any remaining import, dead export, test or e2e step that depended on them (`org-row-type`); any screen that lost
   the only place a person could see the event type.
5. Tests: read `lifeLabel.matrix.test.tsx`: would a reasonable wrong implementation (cancelled counted as not upcoming; section/tag/note from different inputs;
   date page using the old mapping) FAIL it? Name one mutant you tried by reading and whether a test kills it.
6. A11y/phone: 44 px toggle, `aria-expanded`/`aria-controls` truthful, the note wraps at 390 px.

## Output
Last action: push ONE empty commit with subject `review(w3-757): <verdict> [worker-done <ticket>]` to `claude/done-<ticket>` (plain git), then report:
verdict (no findings / findings), each finding as file:line, the failing scenario, severity, and your confidence. Say plainly what you did NOT check.
Never merge or approve, never `--no-verify`, no credentials, Supabase read-only.
