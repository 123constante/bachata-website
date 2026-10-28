# Brief: W3b-2 FIX ROUND 1 on PR #1110 (the ONLY fix round; stopping rule: no third round)

Repo 123constante/bachata-website. Continue on branch `claude/p3-w3b2-date-fields` (head 2c811db; fetch it, do NOT restart from main). Source of findings: Fable review `docs/reviews/1110-r1.md` on branch `claude/review-1110-r1` (`git fetch origin claude/review-1110-r1`, then `git show FETCH_HEAD:docs/reviews/1110-r1.md`). Read all of it first. The builder (you, a fresh session) did not write the review; verdict was no blocker.

Failure to quote (owner rule: say what the check would have caught): a locked row that still carries a live control, and copy that points at a control not on screen, are exactly the "text pointing at a missing control / disabled controls say why" items in the Definition of done. Add the table-driven check so the CLASS cannot return.

## Fix (in this order)
1. **Finding 1 (fix).** `p3/screens/DateSheet.tsx` `OwnRow` (~131-135, ~270-276): when `why` is set (team-shaped price list, festival fields), the "use usual" link must be greyed with the same reason (or hidden). Table-driven test over every row x lock state (festival, team list, cancelled, past, plain): a row with a reason never has an enabled write control. Red first against current code.
2. **Finding 2 (fix).** `labels.ts` `dateNameBlank`: drop "or use the usual name" (no such control on the Name sheet). Add a test that every held reason on the three field sheets names only controls rendered on that sheet.
3. **Finding 6 (cheap).** Grey "Put this date back to normal" on a cancelled date with `L.dateFieldsCancelled` instead of a live row with a disabled Go. Test with the cancelled-with-title prod shape.
4. **Finding 7 (copy).** "photo, name, photos" -> "cover photo, name, photos, price" (labels.ts:124-125 and p3/data/dates.ts:219 area). British English, entities/`\u` escapes only.
5. **Finding 4 (test).** In `tests/e2e/p3-w3b2-geometry.spec.ts` replace the dead `window.scrollY === 0` assertion with one that can go red: assert `.p3-main` scrollTop is unchanged after opening each sheet (or state in a comment why it cannot move and drop the assertion). Prove it red by temporarily removing the `preventScroll` in a local mutant, then revert.
6. **Findings 8, 9 (docs/cosmetic).** Fix the doc-comment drift in `dateFields.ts:11-12`, the handover claims about `v_owner_override_keys` and `COMMAND_COPY` rows, and the "Nothing changed yet" on a dirty-but-equivalent draft if it is one line (compare the same trimmed values as `patch`); otherwise list it as queued.
7. **Findings 3 and 5: do NOT change.** Add one line each to the PR body ("Known limits": orphan uploads on abandon, sheets not portalled, why accepted).

## Hard limits
- Touch only: `p3/screens/DateSheet.tsx`, `DateFieldSheets.tsx`, `p3/data/dateFields.ts`, `p3/data/dates.ts`, `p3/model/dates.ts`, `p3/model/labels.ts` (append/edit W3b-2 rows only), `tests/e2e/p3-w3b2-geometry.spec.ts`, the w3b2 tests, docs. NOT `EventPage.tsx`, `P3Routes.tsx`, `paths.ts`, `wsFixtures.ts`, `Sheet.tsx`, shell/team files, `shared/teamRules.ts` (other sessions have open PRs there).
- Zero bytes to the `/app` first load: `npm run check:bundle-budget` on main and on the branch (report both; main pin 382,976 B, about 342 B spare). Never edit `perf-budgets.json` or `vite.config.ts`.
- Run every CI job step (read `.github/workflows`), put the per-job table and a "Verified on real data / Not verified" block in the PR body (the `real-data-verified` and `phone-qa-section` checks read it: both were red on #1110 for a missing section; fix the PR body). Large source files go through `scripts/safe-edit.py` / `safe-write.py`.
- One push at the end (a checkpoint push may end `[skip preview]`; the final one must not). No prod writes.

## Done =
Push once; final commit subject ends with the done marker from your prompt. Handover: update `docs/handover/p3-w3b2/HANDOVER.md` with a "Fix round 1" section (each finding: fixed / queued / not changed, with the test that was red first). Stop at 30% context with a PARTIAL marker.
