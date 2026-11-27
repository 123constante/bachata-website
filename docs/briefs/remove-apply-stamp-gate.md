# Brief: remove the human review-stamp gate from apply-migration (admin, hard tier)

Owner click 2026-11-11: "Remove the stamp gate". Why: the stamp (`review-stamp.mjs --manual`) needs a human typing CONFIRM at a TTY, which stops the lead applying reviewed migrations. The owner's standing approvals already require independent review PASS + replay proof + prod read-back, so the stamp is a third copy of the same check.

Do (admin repo, branch claude/remove-apply-stamp-gate, from main):
1. scripts/apply-migration.mjs ~lines 820-855: delete the `loadStamp()/stampCoversHash` refusal. KEEP: placeholder refusal, stampLiteralRefusal (boundary literal), destructive-statement gate, --owner-approved-pr, replay/read-after logic. Update header comments (lines ~19-21) and the "[stamp-covered]" print (~1083).
2. Find any other place the stamp gates an apply or merge (grep loadStamp, stampCoversHash, review-stamp, yume-gate, tripwire, scripts/lib/review-scope.mjs, hooks, workflows). Remove ONLY the gate on applying a migration; leave the stamp WRITER and /code-review hook alone.
3. Update tests and any guard/snapshot that pins the gate; add a test: an unstamped, non-placeholder, own-version file passes the gate stage and still fails for placeholder, wrong literal, destructive SQL.
4. Money stays owner-only by the existing rules: do not touch them.
5. PR body: real body at once; Verified / Not verified; per-job CI table. Do not merge or approve.
Hard-tier PR: independent review and CI green at head are required before the lead merges.
