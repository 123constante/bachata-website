# Brief: Website FIX-7 worker (second xhigh review, 12 findings)

Branch `arc/event-truth-p1p3-fix7`, created FROM `origin/arc/event-truth-p1p3-fix6` (head 9d528bf5). Never use `gh api` in this repo; read with git. Open NO PR.
Handover: `docs/handover/event-truth-p1p3-fix7.md`. Push ONLY `arc/event-truth-p1p3-fix7`.
**Keep your session context under 35% (owner rule): read only what you edit, tail logs to 40 lines, commit + push after each group, stop cleanly before 30%.**
The next arc REPLACES the New event chips and the organiser Type row: keep fixes to that code MINIMAL and correct, no polish.
Rules: `src/lib/eventCategory.ts` byte-identical (never edit); never touch `src/components/calendar/**`, `EventCalendar.tsx`, `useCalendarEvents.tsx`;
`&hellip;` entities in JSX; every behaviour fix gets a test RED on 9d528bf5 first (say so) and a mutant. No local CI is billed: you run every CI step (fix-6 handover section 5 is the table) and fill YOUR table before your last turn.

## Fix (real behaviour or copy)
1. **R1 Search chips.** `src/pages/SearchResults.tsx:46` + `useSearchResults.ts:130` + `src/lib/genreSynonyms.ts`: the Search genre chip "Workshop" is an exact match on category `workshop`, but new events never store it (the Workshop create chip seeds a class session, the server derives `class`). Minimal fix: the "Class" chip also matches `masterclass` and `workshop`; the "Workshop" chip stays for legacy rows. Table-driven test over stored words x chips. If the fix needs the search RPC or a calendar file, STOP and report.
2. **R2 dead hint.** `eventType.ts:37` `chipHint` says "Press Create to finish" in phases sent/made even when Create is disabled by `block`. Hint must not name a disabled control: when `block` is set use the exit sentence only. Phase x busy x block table test.
3. **R3 false claim.** `eventType.ts:120` `typeSublabel` returns "Set by its sessions." for a stored word with no session in the non-editable branch. Use `hasSession` (same mapping as the editable branch). Update the matrix rows that encode the old text.
4. **R4 label.** The Party chip creates an event whose editor Type row reads "Night" (and the e2e asserts "Night"), while the OG pill says PARTY. Do NOT edit eventCategory.ts. If one organiser-side label function can read the same word on the New event chip, Type row and ended page, do it; if it cannot without an owner word choice, DO NOT guess: leave it, put the exact fork (the words and screens) in the handover.

## Fix (hygiene)
5. `eventTruth.matrix.test.tsx:158`: type `libSet` as `readonly string[]` (clears the 2 TS2345; report the typecheck count, target 96).
6. `scripts/check-event-truth-v1.mjs:~938`: show the "admin #780 must be applied first" hint only when the P0 payload shape is missing (no `added_sessions`/count), NOT on every category_drift. Update the self-test; mutant.
7. `shared/seriesModel.ts:236` JSDoc says the create reads `firstListedDate`; it no longer does. Fix the comment, drop the vestigial case in `newEvent.seed.test.ts`.
8. `NewEventPage.tsx:57` `created` is redundant with `made`: remove it, keep behaviour (existing tests stay green).
9. `EventEditorPage.tsx:177` + `reviewModel.sessionDates`: derive the upcoming-not-cancelled set once per render (`useMemo`), and `sessionDates` uses `isCancelledDate`.
10. `createHint.test.ts:55`: replace the stale 107/88-character comment with the measured current lengths (90 and 90) and make the "longest hint" assertion not depend on Set order.

## Not in scope (queue in handover, do not touch)
`ogCardRender` masterclass pill row (pins a value the snapshot never emits; leave), the atomic-create "altitude" finding (belongs to the new arc).

## Checks
Run every no-secret step of every `pull_request` workflow (fix-6 handover section 5), then `npm run pre-ship`; baseline env-only reds: 12 live-DB contract tests, e2e flakes `dancer-home.spec.ts:105`, `auth-magic-link-returnto.spec.ts:88/:113`. Any NEW red is yours. Handover with Verified / Not verified and which lines are new logic. Commit, push, stop.
