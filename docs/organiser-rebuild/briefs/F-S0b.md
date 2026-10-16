# Fix brief F-S0b -- one fix pass on slice S0b after the independent review

Repo `123constante/bachata-website`, branch `claude/org-r1-core` (EXISTS, head `2275cdd`; you are the ONLY worker on it), base `main`. You are the author's fix worker, not a reviewer. Plain git only (no `gh api`); write shell commands without variables, loops or `$(...)`. READ FIRST: `00-COMMON.md` next to this file with `<X>` = F-S0b, `S0b-core.md`, and the review: `git fetch origin claude/org-r1-review-S0b` then `git show FETCH_HEAD:docs/organiser-rebuild/reviews/REVIEW-S0b.md`. Also lay S0a's paths over the tree to typecheck, never commit them: `git show origin/claude/org-r1-shell:src/modules/organiser/shell/paths.ts > src/modules/organiser/shell/paths.ts`, then `git checkout -- src/modules/organiser/shell/paths.ts` before you commit.

## The failure the reviewer found (in the owner's words: copy that points at a control that is not there)
A page whose series are all paused or ended (prod: 2 organisers) gets "Change a date" and "Add a date" rows on Home, but the Change list behind them is empty (paused/ended are server-locked, D6). A page with drafts only (prod: 1 organiser) gets the same two rows and no first steps. The matrix test pins the wrong behaviour (`jobs/__tests__/homeJobs.matrix.test.ts` ~line 146) and has no row for a drafts-only page.

## Owner-default decisions (the orchestrator decided these; log them in your handover)
1. `change` shows only when a LIVE series has a scheduled upcoming date (the same test as `cancel`).
2. `add` shows only when a LIVE or DRAFT series exists.
3. When neither `change` nor `add` shows, the page falls back to the four first steps (`create_first_event`, `add_cover`, `show_whatsapp`, `add_manager`), exactly like a page with no listed series. The first steps drop off by their own rules as before.
4. Rows that still apply (`no_dates_left`, `join_request`, `stale_draft`, `no_cover`) keep their D37 order and are not affected.

## Do (only these files: `jobs/homeJobs.ts`, `jobs/__tests__/homeJobs.matrix.test.ts`, `shared/support.ts`, `shared/__tests__/support.test.ts`, `docs/organiser-rebuild/handovers/S0b.md`)
1. **SHOULD-1.** Change the rule per the decisions above. RED first: update the matrix expectations first, run them against the OLD code and paste the failing output (values, not "module not found"), then fix.
2. **SHOULD-2.** Add matrix rows, each asserting exact kinds, labels and `to`: (a) drafts only, one 9 days old and one 2 days old (expect `stale_draft` plus the fallback first steps and NO change/add... unless a draft counts for `add` per decision 2: `add` shows, `change` does not, first steps do not show because `add` shows. Assert precisely what the rule gives and say so in the handover); (b) paused + ended only (expect the four first steps, no change/add); (c) paused + one live series with a scheduled date (expect change, add, cancel as before). Straddle 2026-10-25 and freeze the clock as the existing rows do. `seriesChip` for each fixture must equal the Home row fact (assert from both sides as the existing rows do).
3. **NOTE-5.** `supportLinks` must reject `https://wa.me/` with no number: require a path segment after the host. Add the failing case to `support.test.ts` RED first.
4. **NOTE-2.** In `handovers/S0b.md` replace "drafts older than 7 days: 4" with the reviewer's measured figure (2 stale by the code's London-calendar-day rule, 2 exactly on the boundary) and add one line listing your changes and the four decisions above.
5. Do NOT touch anything else. Do NOT apply the review strip patch (S5 / integration does). Do NOT edit `shell/paths.ts`.

## Tests and CI (shown, not claimed)
- Mutation: after your fix, revert ONLY the new `change` condition and show the new rows go red (the gate stays green against a mutant = revert and report).
- Run in the sandbox with S0a's paths overlaid: `npx vitest run src/modules/organiser/jobs src/modules/organiser/shared src/modules/organiser/flows`, `npm run check:mojibake`, `npm run lint` (note `check:integrity` exit 126 is environmental: the file mode is 100644 in git; `bash bin/check-integrity.sh` exits 0). Per-job table with exit codes in the handover. GitHub Actions refused with a payments annotation is not a code failure.
- Real-data shapes to name in the handover: prod has 2 organisers with only paused/ended series and 1 with drafts and no live series (counts only, from the review).

## Output
Push `claude/org-r1-core`. Last commit subject ends `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at 25% context). Report head SHA and a Verified / Not verified.
