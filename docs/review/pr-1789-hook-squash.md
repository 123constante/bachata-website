# Review: PR #1789 (claude/hook-squash-isolation) — head `6ff5c63db976620a73c804e6d90a5f59c7d722fc`

**Verdict: BLOCK**

Class: hook/guard. Review only. Nothing merged or approved. Brief: `brief/review-1789:docs/briefs/review-1789.md`.

Diff reviewed (`origin/main...6ff5c63`, merge-base `2b493f3`): `scripts/hooks/push-or-block.mjs` (+15),
`scripts/pre-ship.mjs` (+2), `tests/pushOrBlockHook.test.ts` (+16).

## Brief checks

| # | Check | Result |
|---|-------|--------|
| 1 | Stale copy allowed only when it equals squash-merged main content, never real unpushed work | **FAIL**: see B1–B3 |
| 2 | pre-ship runs the dancer-area isolation guard and fails closed | PASS (nit N3) |
| 3 | No path lets unpushed unique commits slip through | **FAIL**: see B1–B3 |
| 4 | Tests cover both the allow shape and the block shape | PARTIAL: one of each, none of the B1–B3 shapes |

## Blocking findings (reproduced)

`contentAlreadyOnMain` asks one question: are the files touched by the unpushed commits identical on
`origin/main` and `HEAD`? That is not the same as "this work is already on main". Below, three throwaway
repos (bare origin + clone) were each run through **main's hook** and then **this PR's hook**:

| Shape (remote `claude/w` exists, 1 unpushed commit) | main hook | PR #1789 hook |
|---|---|---|
| B1: pushed a change to `x.txt`, then an unpushed commit reverts `x.txt` to main's content | exit 2 (block) | **exit 0 (allow)** |
| B2: unpushed **empty** commit `... [worker-done dt_x]` | exit 2 (block) | **exit 0 (allow)**: `files.length === 0 -> true` |
| B3: pushed a new file `y.txt`, then an unpushed commit deletes it (main never had it) | exit 2 (block) | **exit 0 (allow)** |

- **B1/B3 are real unpushed work.** The remote branch, and so the PR, still carries the change that the local
  commit undoes. A typical case is a worker reverting an accidental edit after review and then stopping. The PR
  merges with the edit still in it.
- **B2 defeats Layer 2 of auto-push.** The `[worker-done <ticket>]` done signal is a commit subject. An empty
  marker commit (`git commit --allow-empty`) now passes the Stop hook unpushed, so the orchestrator never sees
  the signal. The same applies to a marker commit whose files happen to match main.

**Why it fails, and a suggested fix.** When `origin/<branch>` **exists**, an unpushed commit cannot be part of a
squash merge of that branch, because GitHub squashes what was pushed. So the content check should not apply on
the `ls.code === 0` path. A narrower rule would close all three holes:

1. For the restart-from-main stale copy (local branch reset to main, remote still holds the pre-squash tip),
   exclude commits already on main from the count: `rev-list --count <range> --not refs/remotes/origin/main`.
   That is exact, with no content heuristic.
2. Apply the content check only on the remote-missing path (`ls.code === 2`, branch deleted after the squash
   merge), which is the real squash stale-copy case.
3. Never treat an empty commit as "nothing to push". At minimum, any unpushed commit whose subject carries
   `[worker-done` must block.
4. Add B1, B2 and B3 to `tests/pushOrBlockHook.test.ts` as BLOCK cases. Also add a remote-missing squash
   case as the ALLOW case. The current allow case runs with the remote present, so it would need reshaping
   under rule 2.

## Nits (not blocking on their own)

- **N1 — rename detection.** `git log --name-only` follows renames and lists only the new path. For a commit
  that renames `a -> b`, where `b` matches main and main still has `a`, the deletion of `a` goes uncompared.
  Use `--no-renames`.
- **N2 — timeout budget.** The header says "Three git calls at most; 3 x 20s stays inside the 90s hook timeout".
  The hook now makes up to 6 calls (ls-remote, fetch, rev-list, fetch main, log, diff). That is 120s worst case,
  more than the 90s in `.claude/settings.json`. On a hook timeout Claude Code allows the stop, so this fails
  open with no WARNING line. Update the comment and the budget, for example a shorter per-call timeout for the
  extra calls.
- **N3 — pre-ship base freshness.** `check:dancer-area-isolation` diffs against the local `origin/main` and
  pre-ship does not fetch first. A stale tracking ref can misclassify a branch. It still fails closed:
  `runCheck` uses `execSync`, so exit 1 or 2 counts as a failed row, and the script returns 2 when it cannot
  measure. The label "dancer-app OR shared code, never both" also slightly overstates the rule, since seam
  files are allowed.

## What was verified

- `npx vitest run tests/pushOrBlockHook.test.ts` on the PR head: 15/15 pass.
- `node scripts/check-dancer-area-isolation.mjs` on the PR head: exit 0 ("not a dancer-area PR: rule c only").
  Its fail-closed contract is exit 2 on no base or an unreadable allowlist, and pre-ship's `runCheck` turns any
  non-zero exit into a failed row.
- B1–B3 reproduced side by side against `origin/main:scripts/hooks/push-or-block.mjs` (blocks) and the PR's
  hook (allows), in throwaway repos.

## Not verified

- CI status of the PR head was not read (plain git only).
- The full `npm run pre-ship` was not run. Only the new check row was run on its own.
- No real-data survey: the PR changes developer tooling and no screens.
