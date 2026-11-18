# Review: PR #1790 (head 40ba2189d)

Scope: delta `b8ca2d154..40ba2189d` on `claude/organiser-r4` (round 2 of the delta, format fix). Reviewed independently from the earlier delta review; no text copied from it.

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Hard-tier scope (save path, routing, feature flags, money) is not touched. The delta changes 13 files, all under `src/modules/organiser/p3/r4/` plus one handover doc under `docs/briefs/`. The only code changes are:

- **(a) Full weekday and month names.** `DAYS` and `MONTHS` in `r4EventsModel.ts` now return "Friday" and "November" instead of "Fri" and "Nov". Calls to `shortDay()` and `toLocaleDateString(..., weekday: 'long', month: 'long')` in `R4Tickets.tsx`, `r4DoorInviteModel.ts`, and `r4TicketsModel.ts` follow the same change. Copy strings in `r4NightModel.ts` and `r4TeamModel.ts` changed to match.
- **(b) Raw Unicode punctuation replaced by escapes.** Curly quotes, the apostrophe and the ellipsis in `r4NightModel.ts` (lines 64-65) and `r4TeamModel.ts` (line 83) are now `‘`, `’`, and `…`. All of them sit inside JS string literals or template literals, not JSX text, so the escapes are evaluated correctly.

Checked against the delta:

- No `save`, `rpc`, `route`, `flag`, or money symbol appears in the changed hunks. Changed `when`, `date`, and `pick` strings are display-only: they flow into `<span>`, `<p>`, `aria-label`, and share captions.
- `shortDay()` is also used by `r4CompareModel.ts` (`day:`) and `r4EditModel.ts` (`fmt`) for display. Neither uses the output as a key or as an input to a request. Sorting in those files compares ISO `date` strings, not the formatted text, so sort order is unaffected.
- `DAYS` and `MONTHS` in `r4EventsModel.ts` are module-private, so nothing outside the file reads them. The shared `calendarUtils.ts` `DAYS`/`MONTHS` (calendar, excluded from density work) are separate constants and are not changed.

## Findings

1. **Nit (test file, not shipped copy).** `src/modules/organiser/p3/r4/__tests__/r4Edit.matrix.test.ts:56` still contains a raw `’` in a test title (`'title is the board’s; no told / refunded line exists'`). It was already in `b8ca2d154`, so this delta did not introduce it. Test titles are not user-visible, so this does not block. It does miss the "raw Unicode replaced by escapes" claim in the PR's scope, so fixing it on a future touch is a cheap follow-up.
2. **Nit (copy length, not verified on phone).** Full names make the strings longer, e.g. "Friday Social, Friday 20 November, 21:00, Soho Dance Studio" in `r4NightModel` and the `when` line in `R4Night.tsx`/`R4Events.tsx`. At 390 px with the public-site `html` size (~13.5 px), these may wrap to two lines. Wrapping is harmless in principle, but the layout has not been walked, so this is a risk and not a defect.

## Checks run

- `npx vitest run src/modules/organiser/p3/r4 src/modules/organiser/p3/door` on `40ba2189d` (worktree, detached): **18 files passed, 612 tests passed, 0 failed.**
- `npx tsc --noEmit -p .` on `40ba2189d`: **exit 0, 0 errors** across the project, including the 13 changed files.
- `npm run check:mojibake` on `40ba2189d`: **2876 files scanned, no cp1252 corruption, exit 0.**
- `git diff --stat b8ca2d154 40ba2189d`: 13 files, 35 insertions, 29 deletions. Confirmed no file outside `src/modules/organiser/p3/r4/` and the handover doc.
- Grep of `src/modules/organiser/p3/r4` (non-test) for raw curly quotes, dashes, and ellipsis: none in production code. Grep for short names (`'Fri '`, `'Nov '`, etc.) in non-test code: none.

## Not verified

- **Phone walk at 390x844.** Not run. The delta is copy and date-format only, but the longer strings have not been seen at phone width, so wrapping and tap targets are unchecked.
- **Prod-shaped data.** No Supabase reads. The changes are formatting only, so no data shape was surveyed.
- **Other CI jobs** for `claude/organiser-r4`. Only the two commands above were run here. The full `npm run pre-ship` and the `integrity` job steps were not run in this review.
- **Editing the PR branch.** Not done, as the brief requires.
