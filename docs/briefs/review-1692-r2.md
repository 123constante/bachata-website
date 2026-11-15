# Brief: independent review r2 of PR #1692 (preship-unit-dedupe)

Review only. Do not edit product code, do not open a PR, do not merge.

Reason for round 2: r1 (`docs/review/1692-r1.md` on `claude/review-1692-r1`) was BLOCK at head 2b004f64. A fix commit landed. Verify the fix; do not rubber-stamp it.

Target: PR #1692, branch `claude/preship-unit-dedupe`, head `56c866ac2aedb9152abe9a5f3b02bc736efc1dec`.
Fetch: `git fetch origin claude/preship-unit-dedupe` then `git diff origin/main...FETCH_HEAD`. Confirm FETCH_HEAD is exactly that sha.

Hard tier (`.githooks/pre-push`, `scripts/pre-ship.mjs`). The change lets pre-push skip the offline unit gate when pre-ship just passed on the same tree.

Check, adversarially:
1. r1 BLOCK closed: the CLI in `scripts/unit-stamp.mjs` is check-only. No CLI path writes a stamp. A test proves the CLI writes no stamp. Only pre-ship, after test:unit passed, writes one.
2. The tree hash and clean-status are snapshotted BEFORE the suite runs, and the stamp is keyed on that snapshot (a file edited during the suite cannot be stamped as clean).
3. A non-finite `nowMs` (NaN, Infinity, undefined) is rejected and fails closed to "run".
4. Still fail-closed: missing, stale (over 60 min), garbled, future-dated, wrong-tree stamp does not skip the gate. A mutant flipping the decision fails the test.
5. Stamp untracked under `.git/`; pre-push still runs every other gate; no env var or `--no-verify` path disables the gate.
6. Windows / Git Bash paths and CRLF.
7. Run: `npx vitest run tests/unitStamp.test.ts`, `node scripts/check-script-conventions.mjs` (if present), `node scripts/prove-entry-point-dispatch.mjs`.

Output: write `docs/review/1692-r2.md` on a NEW branch `claude/review-1692-r2` (from `main`) and push it. The file must contain exactly one line `## Verdict: PASS` or `## Verdict: PASS WITH NITS` or `## Verdict: BLOCK`, and the text `head 56c866ac2aedb9152abe9a5f3b02bc736efc1dec`. Then a short findings list with file:line. End the final commit subject with `[worker-done <ticket>]`.
