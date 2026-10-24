# Brief: resolve the #981 merge conflict (one hunk) and push

Repo: 123constante/bachata-website. Branch: claude/invite-w3-names-person (PR #981, head 87ccef29). Do NOT open a new PR; push to this branch.

Why: #978 (W1) merged into main (7aa131c5) and moved the `organiser_invite_preview_v1` and `redeem_organiser_invite_v1` cases out of `src/modules/admin-organisers/__tests__/routes.matrix.test.tsx`. The branch now conflicts with main in that ONE file.

Task:
1. `git fetch origin main claude/invite-w3-names-person`, check out the branch, `git merge origin/main`.
2. The only conflict is in `routes.matrix.test.tsx`, inside `rpcImpl`'s switch. Resolution: KEEP the two W3 cases (`admin_search_people_v1` and `admin_invite_person_v1`); DELETE the `organiser_invite_preview_v1` and `redeem_organiser_invite_v1` cases (main removed them; W1 tests cover them in `join/__tests__`). Remove the conflict markers. Nothing else changes. Keep the file's line endings as they are.
3. Run `npx vitest run src/modules/admin-organisers` (expect all green), then push once with plain git (the pre-push hook runs the full suite; do not bypass it).
4. Stop after the push. Report: new head SHA and the test counts. Do not merge, approve, or touch other files. If the full suite is red for a reason outside these files, push nothing and write the failing file names in your report.

Output: last push message carries `[worker-done <ticket>]`.
