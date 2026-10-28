# Brief: P3 W3b-1 fix round 1 (PR #1098, branch claude/p3-w3b1-history)

Continue on the SAME branch `claude/p3-w3b1-history` (head f8427f0 or later; fetch first). This is the one allowed fix round: the review is `docs/reviews/1098-r1.md` on branch `claude/review-1098-r1` (`git show origin/claude/review-1098-r1:docs/reviews/1098-r1.md`). Verdict PASS with should-fix, no blocker. Original brief: `git show origin/brief/p3-w3b1:briefs/p3-w3b1.md` (all its rules still apply, including 0 bytes to /app and append-only shared files).

Fix exactly these, each with a test that is RED on the current head first (run it, say so in the handover), then green:

1. Finding 1 (should-fix): `WHO_OF` lookup in `data/history.ts` must not read inherited properties. Use `Object.hasOwn` or a `Map`. Add matrix cases `who: "constructor"`, `"toString"`, `"__proto__"` -> "Someone".
2. Finding 2 (should-fix): one refusal mapping. Build `isHistoryRefusal` on the shared `isAccessRefusal` (`src/modules/organiser/shared/selfServeErrors.ts`) plus only the RPC's own `42501 / not_a_member / not_signed_in` codes; a signed-out caller must NOT read as "not yours" (same as the shared rule). One comment saying why. Test both.
3. Finding 3 (should-fix): page 1 with `has_more` but every row dropped as malformed must still offer "Show older changes" (do not show the empty card while `hasNextPage`). Add the test.
4. Finding 5 (nit): a failed background refetch with data present keeps the rows (guard the error card with `!q.data`). Test it.
5. Finding 4 (nit): no raw U+00B7 in `.ts` source or tests; use `&middot;` style as the repo does (check how `labels.ts` writes it) or a `·` escape in a `.ts` string. Run `node scripts/check-mojibake.mjs` if present.
6. Finding 7 (nit): add the BST START test (29 Mar 2026, 23:00 UTC is already 30 Mar London).
7. Finding 6 (nit): a one-line comment on `enabled: !!user?.id`. No behaviour change.

Out of scope: anything else. Do not add features. Fixes to findings are unreviewed code, so keep each small.

Gates: run `npm run lint`, the history and p3Theme tests, `npm run test:unit -- src/modules/organiser` (let it finish; run it in the background-free way and in parts if it times out), and `npm run check:bundle-budget` on main and on the branch with the perf-budget.yml env; the /app first load delta must stay 0 B. Update `docs/design/1098.md` with a "Fix round 1" table (finding, change, test) and update the PR body (per-job table, Verified / Not verified). Push early with `[skip preview]`, then ONE final push without it, last commit subject ending `[worker-done <ticket>]`. Context cap 30%.
