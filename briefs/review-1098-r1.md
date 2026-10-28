# Review r1: Website PR #1098, P3 W3b-1 History (read only), branch claude/p3-w3b1-history, head f8427f0

Independent review, zero context, different model from the builder (Opus built it). Flag `organiserP3` stays OFF. Read the PR body, `docs/design/1098.md`, and `docs/handover/p3-w3b1/HANDOVER.md` on the branch, and the original brief (`git show origin/brief/p3-w3b1:briefs/p3-w3b1.md`). Diff to review: `git diff origin/main...origin/claude/p3-w3b1-history`. Write `docs/reviews/1098-r1.md` on branch `claude/review-1098-r1` (from `main`; docs file only; never push the builder branch). Open a docs-only PR titled `docs(review): PR #1098 r1 independent review`.

Stopping rule: this is round 1 of at most 2 (one review, one fix round). Verdict PASS / PASS with should-fix / BLOCK. Number every finding; mark each Blocker / Should-fix / Nit with the file:line.

Check, with the read-only Supabase connector (prod `stsdtacfauprzrdebmzg`, SELECT only, counts only, no personal data):
1. Data source: read `organiser_series_history_v1` with `pg_get_functiondef`; every field the parser reads (`at`, `kind`, `label`, `who`, `date`, `fields`, `has_more`, `next_before`) exists as used. The cursor goes back to the RPC unchanged (prod values carry microseconds: is there any JS Date round trip that would truncate them and repeat or skip a row on page 2?).
2. Who and refusal: `who` words, unknown/missing `who`, and the not-on-the-team refusal use ONE shared mapping. The `NotYoursCard` extraction in `EventPage.tsx` keeps the old copy byte for byte and the existing screens still render it.
3. States: empty, one row, a short list, a list over one page (Show older changes), error with Try again, malformed row. Every empty state says what the person can do; no copy points at a control that is not on screen; no Undo is drawn anywhere.
4. Dates: grouping by day in Europe/London across the BST change (last Sunday of October is 25 Oct 2026; March too), full weekday names, no raw Unicode punctuation in JSX (use entities).
5. Append-only: `labels.ts`, `paths.ts`, `P3Routes.tsx`, `wsFixtures.ts`, `p3Theme.contrast.test.ts` only gained lines; website-c2 is rebasing PRs over the same files.
6. Bundle: the History chunk is lazy and not in the `/app` first load. Build with the perf-budget.yml env on main and on the branch and compare `/app` first-load bytes exactly (main CI was 382,956 B of a 382,976 B pin; the build env can differ by a couple of bytes). Report the delta in bytes. Also confirm `perf-budgets.json` and `vite.chunks.ts` are untouched and that no new importer split a chunk.
7. Mutation: pick two of the matrix tests and break the code under them (who map; the next-page cursor). They must go red. A mutant that stays green is a finding.
8. Run `npm run lint`, `npm run test:unit -- src/modules/organiser` and the new e2e spec in the sandbox. Check the contract-check and phone-qa reds on the PR against main before blaming the diff (contract-check og-render 403 is known and red on main; phone-qa `invite-w2-golive` is load-sensitive and fails on main too).
9. Anything the builder claims "verified" that was only "pinned in a test": say which.

End with Verified / Not verified. Do not edit source. Push early, end the last commit subject with `[worker-done <ticket>]`.
