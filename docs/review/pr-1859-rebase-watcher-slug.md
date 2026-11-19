# Review: PR #1859, pr-auto-rebase slug.repo -> slug.name (read-only review, one pass)

Reviewer: independent agent. Reviewed head `bdcbc87d367246805f041a9b36358faa145ef4ec` of `claude/rebase-watcher-slug-fix` against `main`. No product code changed by this review.

## Verdict: PASS

The fix is correct and minimal. `parseRepoSlug` (`scripts/check-pr-mergeable.mjs:434-445`) returns `{ owner, name }` or `null`. `scripts/pr-auto-rebase.mjs` read `slug.repo` at two places (GraphQL variables, REST base URL), which is `undefined`: the GraphQL call would drop `name` and the REST base would be `.../repos/<owner>/undefined`. Both now read `slug.name`.

## Checks

- Diff scope: one file, `scripts/pr-auto-rebase.mjs`, 17 insertions, 2 deletions. Two one-word fixes plus one new self-test case. Nothing else changed.
- Test fails on the old code: mutated the head file back to `slug.repo` and ran `node scripts/pr-auto-rebase.mjs --self-test`: `FAIL repo name reaches the GraphQL query ... {"owner":"acme"}`, `FAIL self-test -- 19 cases`. On the head file: `PASS self-test -- 19 cases`.
- The test restores `globalThis.fetch` in `finally`, sets `--dry-run`, and uses `GITHUB_REPOSITORY` so it needs no git remote.
- Other callers: grep for `slug.repo` across `scripts`, `.github`, `src` on `main` finds only the two fixed lines. Other `parseRepoSlug` users are inside `check-pr-mergeable.mjs` itself (`resolveRepo`, spread into GraphQL variables) and use the real shape.

## Findings

None blocking. Nit (not required): the REST `base` URL is not asserted by the new test; the GraphQL variable assertion covers the same wrong-field cause.
