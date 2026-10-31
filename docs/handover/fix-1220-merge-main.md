# fix-1220-merge-main handover

Branch `claude/p3-fix-cache` (PR #1220): merged `origin/main` (merge commit), finished F-33.

## Conflict table
| File | Hunk | Kept | Why |
|---|---|---|---|
| `src/modules/organiser/p3/screens/EventPage.tsx` | import block (eventPage + model) | BOTH | #1220 adds `publicPageOf` (F-34); main (#1217) adds `STATUS_COPY` and `removedStatus`. Union of names; all are used. |

Auto-merged cleanly (no conflict): `p3/data/dates.ts`, `p3/data/eventPage.ts`.

Semantic fallout from the merge (not a text conflict): `dancerView.matrix.test.tsx` `archived` row. Main's removed-event card now replaces the page for archived events, so no "See it as dancers see it" row exists; the test now expects `p3-event-removed` and no dancer-view link.

## F-33 completion
- `p3/data/sessions.ts` `useDateSend().reload()` now calls `invalidatePublicEventCaches(qc)` (signature is `(qc)` only, no seriesId).
- Exemption for sessions.ts removed from `publicCache.test.tsx`. Red first: the completeness test failed for `sessions.ts` AND `p3/new/useCreateSave.ts` before the calls were added.
- `p3/new/useCreateSave.ts` did NOT invalidate. Its `refresh()` (called on success, partial failure, details stop, discard) now also calls the helper. Covered by the file-level completeness test; no behavioural test added.

## Verified
- vitest: organiser p3/screens, shared, p3/new all pass after the matrix fix. `npm run build` + `check:bundle-budget`: all first-load budgets respected (no budget file edits).
- tsc: errors exist in organiser tests/OnboardingFlow, none in files touched here (appear environment/pre-existing; not compared against main).

## Not verified
- Full CI job-by-job local run (only vitest, tsc, bundle budget attempted).
- Browser walk at 390x844, prod-shape survey (no new shapes introduced; none re-run).
- PR body bullets not updated (no GitHub write access used); owner should keep: Shapes surveyed / Checks run / NOT verified / Sizes checked / Walked / Not verified.
