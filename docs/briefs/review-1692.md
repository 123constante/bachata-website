# Brief: independent review of PR #1692 (preship-unit-dedupe)

Review only. Do not edit product code, do not open a PR, do not merge.

Target: PR #1692, branch `claude/preship-unit-dedupe`, head `2b004f64d9c10417f48e0a9a87fc80830bbd9a54`.
Fetch it: `git fetch origin claude/preship-unit-dedupe` then `git diff origin/main...FETCH_HEAD`.

This is hard tier (`.githooks/pre-push`, `scripts/pre-ship.mjs`). The change lets pre-push skip the offline unit gate when pre-ship just passed on the same tree.

Check, adversarially:
1. FAIL CLOSED: a missing, stale (over 60 min), garbled, future-dated or wrong-tree stamp must NOT skip the gate. Read the decision function and its test; confirm a mutant that flips the decision makes the test fail.
2. The stamp is keyed by the git TREE hash of what is being pushed, not just HEAD, and cannot be satisfied by a dirty or different tree (staged/unstaged changes, a new commit after pre-ship).
3. Stamp lives untracked under `.git/`, is not committable, and writes only after test:unit actually passed (not on a skipped or failed run).
4. pre-push still runs every other gate; only the duplicate unit run is skipped. No `--no-verify` path, no env var that silently disables the gate.
5. Windows and Git Bash both work (path handling, CRLF).
6. Run: `npx vitest run tests/unitStamp.test.ts`.

Output: write `docs/review/1692-r1.md` on a NEW branch `claude/review-1692-r1` (from `main`) and push it. The file must contain exactly one line `## Verdict: PASS` or `## Verdict: PASS WITH NITS` or `## Verdict: BLOCK`, and the text `head 2b004f64d9c10417f48e0a9a87fc80830bbd9a54`. Then a short findings list with file:line. End the final commit subject with `[worker-done <ticket>]` as your prompt says.
