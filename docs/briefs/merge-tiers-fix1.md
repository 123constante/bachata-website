# merge-tiers fix round 1 (continuation on claude/merge-tiers, PR #1679)

Lead /code-review of #1679 found the items below. Fix them in the SAME PR, same branch, ONE commit, no new review round. Keep the flag OFF. Add a test case per fix to tests/mergeTier.test.ts (or the audit test file).

1. `scripts/owner-approval-audit.mjs` tier-B shortcut (~line 394): accept a self-review body only when the PR author is `kiki-claude-bot`. A human or other-author PR with `## Self-review` must stay RED.
2. `scripts/lib/merge-tier.mjs` `hasSelfReview`: require at least one non-blank line after the heading that is NOT an HTML comment, `-`, `TODO`, `n/a`, `none`, or `tbd` and has at least 12 letters/digits. Placeholder bodies fail.
3. Audit shortcut `prs.find(...)` (~line 394/415): use only the PR whose `merge_commit_sha` equals the audited sha, never any associated PR. If none matches, no shortcut.
4. `docs/proposals/revert-on-red.yml`: (a) if `git revert --no-edit` conflicts or the push fails, open an `owner-turn` issue naming the sha and the red workflow, then exit 0; never fail silently. (b) Duplicate guard: also search closed/merged PRs and existing issues for `claude/revert-<sha8>` (any state) before reverting.
5. `scripts/lib/merge-tier.mjs` SECRET regex: match `.env`, `.env.*`, `.envrc`, `env.production`-style basenames by basename; match `secret` / `secrets` only as a whole path segment or file stem word, not inside prose names like `secret-santa.md`. Add both sides to the tests.

Not in scope (lead accepted): body edited after merge, auto-merge window between push and synchronize, 3000-file cap.
Stop rule: all five done, tests listed, push, handover, `PARTIAL`/`DONE` marker as usual.
