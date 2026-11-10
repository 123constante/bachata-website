# Brief: Independent read-only review of PRs 1439 and 1429
Brief-version: 2
Branch: claude/review-door-raffle-1439-1429
Lane: normal, Opus. Repo 123constante/bachata-website. Read-only: one report branch, NO PR.

## Goal
Independent review of two open Website PRs: #1439 (door scanner: a refused card gets Check again and Back to events) and #1429 (raffle board screens on the tile and /raffles, R3b-2). Report what would break for real users; change no code.

## What main lacks
- no independent review exists for PR 1439 (door refused card) or PR 1429 (raffle board) -- grep: review-door-raffle-1439-1429

## Files
- docs/review/review-door-raffle-1439-1429.md (new)

## What to build
1. For each PR, at its current head, read the diff and the PR body. Note each head sha in the report.
2. Attack list, per PR: (a) every state a door worker or a raffle entrant can reach (refused, offline, expired, already scanned, empty board, huge board, no winners) and what the screen says and offers; (b) copy that points at a missing control; (c) 390x844 by reading measured numbers, no screenshots unless something looks off (taps at least 44px, no clipping, no sideways scroll); (d) data shape: read-only SELECT counts on prod (project stsdtacfauprzrdebmzg) for the raffle board (entries per raffle, none, huge, past) and door scan outcomes; no personal data; remember the 100-row API cap; (e) anything the PR touches under a guard list or the calendar density-exempt files.
3. Verdict per PR: PASS, PASS-with-fixes (list each fix as a claim with file:line and the check that would catch it) or BLOCK, ordered by severity.
4. Say plainly what was NOT verified.

## Do NOT touch
supabase/**, workflows, scripts/**, .env*, any file not listed under Files. Review only: no code change, no approve, no merge.

## Done when
One push of the report to the branch; no PR; the last commit subject ends with the [worker-done ...] marker.
