# Brief: independent review of PR #1159 (F4: sign-in lands a new organiser on P3 Welcome) -- READ-ONLY, findings doc only

Repo 123constante/bachata-website. Review branch `claude/p3-f4-signin-lands-welcome` (head 9db9b2a) against `main`. You did not build it. You write ONE file on branch `claude/review-1159-r1`: `docs/review/pr-1159-r1.md`. No source edits, no tests added, no DB write (Supabase read-only, counts and function bodies only, no personal data).

## Read
`git fetch origin claude/p3-f4-signin-lands-welcome` then `git diff origin/main...FETCH_HEAD --stat`. Files: `src/lib/auth-otp-routing.ts` (`newOrganiserLanding`, `landingPathAfterAuth`), `src/lib/accountRouting.ts` (`signInLanding`), `src/components/account/profiles/ContinueAsPage.tsx`, `src/components/AnimatedRoutes.tsx`, `src/pages/AuthCallback.tsx`, both new tests, `docs/handovers/p3-f4-signin-lands-welcome.md`. Brief: `docs/briefs/p3-f4-signin-lands-welcome.md` on `brief/p3-f4-signin-lands-welcome`.

## Judge (find real defects; do not restate the PR)
1. Every person kind x flag combination (new organiser done/unfinished, intent with an open access request, existing organiser, existing organiser with intent, dancer, dancer unfinished, invite claim, two organisers; organiserP3 x organiserSelfServe on/off): is the landing right, and is any row missing from the table-driven test? Is the `/invite/<token>` returnTo always winning?
2. Flag-OFF guarantee: with P3 off is every landing byte-for-byte what main did? Any P3 import that now loads on an always-loaded route (bundle)?
3. Can a person land on `/account/p3/start` and be stuck or bounced (no dancer-profile gate there, back arrow, a refresh, a second sign-in)? Walk the code path, say what the screen does.
4. Does "new organiser" use the same source of truth as the P3 area (`organiser_home_v1`)? Is there any second copy of the rule?
5. Honest PR body: do the Verified / Not verified claims match the diff?

## Output
Findings ranked most severe first, each: file:line, what is wrong, a concrete failing input, severity (blocks merge / fix before arc end / nit). Mark each CONFIRMED (you traced it) or PLAUSIBLE. End with a short "Not reviewed" list. Zero findings is valid if you say what you checked.

## Done =
Push `claude/review-1159-r1` once; final commit subject ends with the done marker from your prompt. Stop at 30% context with a PARTIAL marker.
