# Brief: independent review of PR #1118 (P3 W4b build 1: onboarding + claim in the P3 look)
Reviewer: Fable (never builds, never edits src/). Output ONLY docs/review/pr-1118-r1.md on branch claude/review-1118-r1. Verdict PASS / PASS with should-fix / BLOCK; findings S1.. (should-fix) and N1.. (notes), each with file:line, failure scenario, and the check that would have caught it.
Target: branch claude/p3-w4b-onboarding at its head; builder handover docs/handovers/p3-w4b-onboarding.md; design record docs/design/p3-w4b-onboarding.md; owner picks and mockups on origin/claude/p3-w4b-mockups (docs/design/p3-w4b-mockups.md, docs/design/p3-w4b/*.html; read via git show, do not merge).

## Owner decisions (binding)
New account = mockup A. Unfinished profile = option B: same screen as a new account; the check runs at the tap via the existing ProfileGateContext fact, no new read; a "Finish your profile" button naming what is missing goes to /finish-profile via finishProfileHref; never "Message us" there. Return copy ships as drawn ("come back to Welcome; search again"); no returnTo carry. No-dancer-row (2 of 42) keeps today's message-us in its own frame. Flag organiserP3 stays OFF; R1 /account/o unchanged.

## Must check (mutate where you can; a gate that stays green against its mutant is a BLOCK)
1. Gate correctness: read the live RPC bodies read-only on prod (_require_complete_dancer_profile_v1, profile_complete_v1, request_signup_access_v1, claim/ask-to-join/create RPCs). Does the client tap gate agree with the server for every shape (first_name, city, dance_role, avatar; admin exempt; no row)? Mutate profileGate.ts (flip one field, drop the error fallback) and show the matrix goes red.
2. Fail-safe: completeness read error -> falls back to today (buttons on, server decides). Confirm by test and by reading.
3. Any path that sends claim/ask/create while incomplete, or that blocks a COMPLETE profile or an admin. Untouched save sends nothing.
4. Redirect loops: P3 Home with no page -> Welcome -> claim -> Home; race fix (p3-ok). Try back button, refresh, flag off.
5. Copy never points at a missing control; every state actionable; disabled controls say why.
6. R1 (/account/o) and the flag-off path really unchanged (tests, imports, bundle).
7. Design: tokens only from p3.css (no new colours), 44px taps in explicit px, focus/overlay geometry (portalled sheets, preventScroll), light + dark.
8. CI honesty: the PR body says 17 unit tests in 5 files fail identically on main in the sandbox, and the e2e walk SKIPS in the gate (organiserP3 off in e2e-smoke dev server). Verify against real CI at the head (gh pr checks) and say whether the walk is protected anywhere.
9. Bundle: /app first load unchanged (check:bundle-budget main vs branch).
Stopping rule: one review. Push docs/review/pr-1118-r1.md once and report. Context cap 35%.
