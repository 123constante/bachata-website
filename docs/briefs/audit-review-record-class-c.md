# Brief: owner-approval audit also checks the class C review record (detective)
Brief-version: 2
Branch: claude/audit-review-record-class-c
Lane: careful, Opus. Website; hard-tier files (scripts/), so owner Approve at the final head. Must not touch .github/workflows, scripts/automerge-classify.mjs or any gate's pass/fail result.
Serves: the owner, who wants proof after the fact that every auto-merged test PR carried its review record, so auto-merge can be trusted without per-PR checks.

Source: arc file docs/arcs/automation.md, row "Follow-ups from the auto-merge review" (READY-QUEUE: "owner-approval-audit.mjs also check the review record (detective)").

## What main lacks
- A pure `decideRecordAudit` that, for a commit on main touching a class C test file, reports whether its merged PR had a valid review record at the PR head -- grep: decideRecordAudit
- The audit prints one `RECORD-MISSING <sha8>: ...` line per commit whose class C PR had no valid record, and still returns the same exit code as today (detective only, never changes OK/RED/INFRA) -- grep: RECORD-MISSING
- A table-driven test of that verdict over every record shape (valid, no pack comment, pack for another sha, pack older than push, label by a human, label missing, API error) -- grep: decideRecordAudit in tests/ownerApprovalAudit.test.ts
- extends: docs/automerge.md class C section says the audit now reports missing records -- docs/automerge.md

## Files
scripts/owner-approval-audit.mjs
tests/ownerApprovalAudit.test.ts
docs/automerge.md
docs/arcs/automation.md

## What to build
1. In scripts/owner-approval-audit.mjs add and export `decideRecordAudit({ files, pr, record })` returning `{ applies, ok, problems }`. `applies` is true only when some file has `pathClass(f) === "tests"` imported from scripts/automerge-classify.mjs (do not copy the path rule); the problems come from the existing `reviewRecordVerdict({ headSha, labels, record })` there (reuse it, do not copy it). Any unreadable record gives ok=false (fail closed).
2. In `auditCommit` read the record for each merged PR that applies, using the existing `readReviewRecord(repo, num, headSha, events)` and the issue events API, and in `main` print `RECORD-MISSING <sha8>: PR #n <first problem>`. The worst-code logic must not change: a missing record never turns OK into RED or INFRA.
3. A commit whose PR the owner approved at head is skipped (the owner's approval is the stronger record); print one line saying so.
4. Update docs/automerge.md (one paragraph) and, in the same PR, this slice's row in docs/arcs/automation.md (Status, Blocked by, PR link) per owner decision 2026-11-06.

## Tests
Table-driven in tests/ownerApprovalAudit.test.ts, red first (write the table before the function). Rows: non-test file (applies=false), tests file with valid record, no pack, pack for another sha, pack before push, label by human, label absent, record error, owner-approved head skipped. Plus one case proving the exit code of a mixed run equals today's. Run `npx vitest run tests/ownerApprovalAudit.test.ts tests/automergeClassify.test.ts`.

## Done when
Tests green and red-first shown; `npm run lint` chain and the PR's own CI steps run; PR body has a Verified / Not verified block (Not verified: a live run against real merged PRs, say so); hard-tier PR left for owner Approve.
