# Brief: fix round for PR #1692 (preship-unit-dedupe), after review BLOCK

Branch `claude/preship-unit-dedupe` already exists (PR #1692, head 2b004f64). Check it out, push fixes ON TOP (no force). Read the review: `git fetch origin claude/review-1692-r1` then `git show FETCH_HEAD:docs/review/1692-r1.md`.

Do exactly these, nothing else:
1. REQUIRED (finding 1): remove the `write` branch from the CLI `scripts/unit-stamp.mjs` so the CLI only does `check`. Keep the `writeStamp` export (pre-ship imports it directly). Update the header comment. Add a test that the CLI given `write` writes NO stamp file and prints `run` or exits non-zero (use a throwaway git repo in a temp dir).
2. Finding 2 (race): in `scripts/pre-ship.mjs` read `HEAD^{tree}` and the clean-status BEFORE running test:unit; after it passes, write the stamp only if the tree and clean status are unchanged. Cover with a unit test on a pure helper if one exists, else keep it small.
3. Finding 4: add `decideUnitStamp(formatStamp(TREE, NOW), TREE, NaN).skip === false` to the unit test, and make the function satisfy it (keep the `Number.isFinite` guard; also reject a non-finite `nowMs`).

Do not touch any other file. Run `npx vitest run tests/unitStamp.test.ts`, `node scripts/check-script-conventions.mjs`, `node scripts/prove-entry-point-dispatch.mjs`. Update the PR body Verified section. Push, final commit subject ends with the worker-done marker from your prompt. Open no new PR.
