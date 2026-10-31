# Brief: independent review r1 of Website PR #1218 (p3 home copy + all dates paging, FIXLIST F-16 / F-27)

Repo 123constante/bachata-website. Builder: Opus on `claude/p3-fix-home-dates` (head 288f8f941). You are the Fable reviewer: write ONLY `docs/review/pr-1218-r1.md` on branch `claude/review-1218-r1` (from origin/main). Never edit the builder branch. Context cap 35%.

Read first: `docs/design/p3-acceptance/FIXLIST.md` rows F-16 and F-27 and the audit lines they cite; `docs/briefs/p3-fix-home-dates.md` on `origin/brief/p3-fix-home-dates`; the PR #1218 body (`git show origin/claude/p3-fix-home-dates:docs/handover/` for the handover files; the body text is in the brief's PR template); then `git diff origin/main...origin/claude/p3-fix-home-dates`.

Verdict per row, PASS / FAIL / PARTIAL with file:line:
- **F-27 DATES-100:** on shapes 0, 1, 57 future, exactly 100, 101, 132 (prod largest) and 657 (3 pages of 200): the Past and Cancelled counts before loading older dates equal the counts after loading everything; "Load older dates" appears only when `has_more` is true; a failed older read says what to do and has Try again; the note names a button that is on screen; the sheets (cancel, uncancel, edit) see loaded older dates too. Does `p_before` paging start from the right anchor (`meta.next_before`) and never skip or duplicate a date? Does `keepPreviousData` leave a stale count visible after a filter change?
- **F-16 HOME-COPY:** `nextUpAdviceOf` in `p3/model/status.ts` is the ONE mapping. Check every shape the FIXLIST row names (live with future dates, live past one-off, draft, paused, ended, archived beside ended, no events). The Home wiring is a patch in `docs/handover/p3-fix-home-dates-F16-wiring.patch` for the lead to apply after #1208: review the PATCH too (does it apply onto `origin/claude/p3-create-event-build`'s HomeScreen and screens.matrix? run `git apply --check` against both main and that branch and report).

Cross-cutting checks (owner rules):
1. ONE shared mapping for any fact on more than one screen (counts in AllDates vs the server summary; next-up advice). Grep for a second copy.
2. No copy points at a control not on screen; every empty, loading and error state is actionable.
3. Red-first: the builder pasted red lines; re-run the new tests against main's `AllDatesScreen.tsx`, `dates.ts`, `eventModel.ts` yourself and report which go red. A test green on unfixed code is a FINDING.
4. Files owned by #1208 untouched (sessions.ts, RepeatSheet.tsx, parts.tsx, screens.matrix.test.tsx, P3Routes, P3Shell, shell/paths, p3/new/**, you/surface.tsx, package.json). The patch may touch screens.matrix; the branch itself must not.
5. `npm run build && npm run check:bundle-budget` on main AND the branch: delta to the dancer-app first load must be 0 bytes (the builder did not compare against main; you do).
6. Prod source of truth, read-only: confirm `admin_event_workspace_p5(uuid, date, integer)` really returns `meta.has_more`, `meta.next_before`, `meta.total`, `meta.counts` (read the function body; counts only, no personal data).
7. `npm run lint`, `npx tsc --noEmit`, `npx vitest run src/modules/organiser`.

Output: `docs/review/pr-1218-r1.md` with verdict PASS / PASS WITH NITS / BLOCK, findings F1..Fn with severity, file:line and the exact fix, and a Not verified list. Commit subject `docs(review): PR #1218 home-dates r1 <VERDICT> [worker-done <ticket>]`, push once.
