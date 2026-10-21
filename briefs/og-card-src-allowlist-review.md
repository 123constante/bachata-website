# Brief: independent review of Website PR #938 (og card SSRF allow-list)

Repo `123constante/bachata-website`. You are the REVIEWER, not the author. Work ONLY on your own branch
`claude/review-og-card-src-allowlist` (from `main`); never push the PR branch. Push ONCE at the end. Opus.

## Read
- PR #938, branch `claude/og-card-src-allowlist` (head e56d1862): `git fetch origin claude/og-card-src-allowlist`, then
  `git diff origin/main...FETCH_HEAD`. The author's handover: `docs/handover-og-card-src-allowlist.md` on that branch.
- The author's brief: `git fetch origin brief/og-card-src-allowlist` then `git show FETCH_HEAD:briefs/og-card-src-allowlist.md`
  (owner decisions there are settled; do not reopen them, only check they were followed).

## Review for (correctness and security, not style)
1. Bypasses of `isAllowedOgImageSource`: encoded dot segments (`%2e%2e`), encoded slashes (`%2F`) and backslashes in the
   supabase path prefix, trailing-dot hosts (`media.bachatacalendar.co.uk.`), IDN/punycode, IPv4 forms like `0x7f.1`,
   `2130706433`, IPv6-mapped IPv4. Write each as a test case on your branch and run it against the PR code.
2. `redirect: "error"` really prevents following redirects in the Vercel runtime used here (Node fetch/undici).
3. Every server-side image fetch now goes through `fetchImageBytes` (grep app/ and api/ for other `fetch(` of image URLs,
   including `api.og.bake.tsx`). A missed path is a blocker.
4. Real-data regression: with read-only SELECTs (Supabase connector, URLs only, no personal fields) take 10 live cover/avatar
   URLs across the hosts in the brief's survey and confirm each would still be allowed; any live URL newly refused is a blocker
   unless it is example.com.
5. The tests can fail: mutate the allow-list (e.g. drop the exact-host check, or the redirect option) in your sandbox, run
   the tests, record that they go red, revert.

## Output
`docs/reviews/review-og-card-src-allowlist.md` on your branch: verdict SHIP or FIX FIRST; findings numbered B1.. (blocker) and
N1.. (nit), each with file:line, the failing input, and the exact fix; the mutation results; the real-data table.

## Rules
Never merge or approve. Plain git only (never `gh api`). No variables/loops/`$(...)` where a plain command works.
Never `--no-verify`. Supabase is READ-ONLY. GitHub Actions billing refusals are not code failures.
Final commit subject ends `[worker-done <ticket>]`. Stop after the push and report.
