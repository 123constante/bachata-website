# Brief: P3 W-T fix 3 (Website, normal lane, Opus builder)

Branch `claude/p3-wt-fix3` from current `main` (W-T #1079 is merged as 4d7b57b; flags `organiserP3` and `organiserTicketing` are OFF in prod). Context cap 30%: push early. Source of truth: the independent review `docs/review/pr-1079-r3.md` on branch `claude/review-1079-r3` (fetch it, read S1 and N1-N3 in full). You fix exactly those four and nothing else.

Owner words: the owner wants the class fixed and a check that would have caught it ("If the owner finds a bug this list would have caught: fix the class, add the check").

1. **S1 (should-fix, money-adjacent).** The toast column (`.p3-toast-stack`, `p3.css`) is anchored at the bottom over the open sheet's sticky footer; an alert's Dismiss sits exactly over "Refund GBP 24.00" / "Put on sale". Move the column off every footer (reviewer's fix: anchor at the top below the top bar, `bottom: auto`; or render it inside the top layer above the footer). Pin it in `p3/tickets/__tests__/layout.cascade.test.ts` (resolved `bottom` is `auto`, `top` is set) and add an e2e/unit geometry assertion at 390x844 that no toast box overlaps the open sheet's confirm button, with 1, 3 and 6 toasts. Mutate your own fix: revert the rule and show the test goes red.
2. **N1.** A late edit that renamed a ticket is announced under its OLD name (`TypeSheet.tsx:65`). Use `form.name.trim() || type?.name || 'New ticket'`; flip the assertion at `stack.draft.test.tsx:435`.
3. **N2.** Escape mid-close is a silent no-op. Route it as the reviewer suggests or document the no-op; pick the routing and test it.
4. **N3.** Alert keys by id are not pinned: add the P10 test (same order refused twice, identical texts, two alerts, each dismissed alone); mutate the keys to text and show it goes red.

Standing header lines:
- Prove the data source first: this slice changes no data path; say so.
- Zero bytes to the /app first load: run `npm run check:bundle-budget` on main and on the branch (main is 373.6 KB of 374 KB); never edit `perf-budgets.json` or `vite.config.ts`.
- Overlay geometry: sheets and toasts portalled to `document.body`; opening one must not scroll the page; an e2e at 390x844 asserts the sheet, confirm button and toast boxes sit inside the viewport.
- Stopping rule: one independent review will follow, one fix round, then the orchestrator walk.
- Append-only edits in shared P3 files (`p3.css`, `P3Routes.tsx`, `paths.ts`, `labels.ts`, `EventPage.tsx`); do not touch another session's branches.
Run every CI job step in your sandbox and put the per-job table in the PR body, with the `## Verified on real data` section (Shapes surveyed / Checks run / NOT verified, one line each). Final commit subject ends `[worker-done dt_<ticket>]`.
