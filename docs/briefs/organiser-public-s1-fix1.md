# Fix round 1 for PR #1282 (organiser public S1)

Branch claude/organiser-public-s1-errors. Review: docs/review/pr-1282-r1.md on claude/review-1282-r1 (git show origin/claude/review-1282-r1:docs/review/pr-1282-r1.md).
Base check: git fetch origin main; merge main if behind; merge-base must equal origin/main before you push.

Do, red first where a test applies:
1. F1: src/pages/OrganiserProfile.tsx ~1385: the hero stats strip must never show a number for a feed that failed. Owner rule: HIDE a stat that has no real number (do not show 0 or a dash). Upcoming dates hidden while the future or events feed failed, Past nights hidden while the past or events feed failed, events count hidden when the events feed failed. Add rows to OrganiserProfileFeedError.matrix.test.tsx asserting the strip has no "0" for a failed feed (run against current code first, report the failed count), plus that a healthy zero is handled by the existing hide-empty-stat rule (do not change that).
2. F2: hoist the dynamic import in app/routes/organiser.loader.test.ts to module level (or testTimeout 15000) so a cold run cannot time out; run both new test files together 3 times.
3. F4: fix the comment at app/routes/organiser.tsx:145 ("browser no-store" is wrong: max-age=0, must-revalidate). Comment only.
Leave F3. Update the handover, run lint and the related tests, push once, last commit subject ends with the worker-done tag. Context cap 30%.
