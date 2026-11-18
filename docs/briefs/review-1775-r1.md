# Review PR 1775 r1: server-today HEAD /robots.txt + 3 s timeout (independent review, read-only)

Repo 123constante/bachata-website, branch claude/server-today-nits, PR #1775 (head 9952621f1). Review only; never push to the builder branch.

Check: (1) src/modules/dancer-app/screens/tickets/serverToday.ts fetches '/robots.txt' with method HEAD, cache no-store and AbortSignal.timeout(3000); an abort or timeout still falls back to the device London clock; AbortSignal.timeout exists in the supported browsers (say if not). (2) public/robots.txt exists and the host answers HEAD on it with a Date header and no redirect or middleware rewrite (check vercel.json / middleware). (3) The new test is not vacuous. (4) Scope: nits N1 and N2 only.

REQUIRED report format: the review doc header must be exactly `# Review PR 1775 r1 (head <full 40-char sha of the PR head>)`, then one line `## Verdict: PASS` or `## Verdict: FAIL`, then one line `## Hard-tier: PASS` or `## Hard-tier: FAIL`, then up to 5 findings. Put the doc at docs/review/pr-1775-r1.md on branch claude/review-1775-r1.
