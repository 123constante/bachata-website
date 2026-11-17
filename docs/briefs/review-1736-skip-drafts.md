# Review PR #1736 (read-only): skip heavy CI jobs on draft PRs

Branch under review: claude/ci-skip-drafts (head 742f4d76b). Do not push to it. You cannot comment on the PR. Instead create docs/review/pr-1736.md on your branch claude/review-1736-skip-drafts (from main), containing `## Verdict` (one line), `## Hard-tier: PASS` or `## Hard-tier: FAIL` (with reviewed head SHA 742f4d76b), then findings one line each. Read the PR branch with `git fetch origin claude/ci-skip-drafts`. Make no other change.

Change: job-level `if: github.event_name != 'pull_request' || !github.event.pull_request.draft` on e2e-smoke.yml (e2e-smoke), unit-tests.yml (unit, dancer-area-isolation), phone-qa.yml (phone-qa, build-smoke); pull_request types now [opened, synchronize, reopened, ready_for_review].

Check:
1. YAML valid; CRLF preserved.
2. A skipped job reports success to required checks (no merge deadlock); confirm against branch protection required contexts.
3. No workflow or script breaks when these jobs skip: revert-on-red.yml, phone-qa-rerun.yml, bot-automerge.yml, queue-merge.yml, autopilot.yml, scripts/check-pr-mergeable.mjs (NO_GATES_RAN: other gates such as architecture-guard/typecheck still run on drafts).
4. push to main and workflow_dispatch still run every job.
5. Default PR types unchanged except ready_for_review added.
