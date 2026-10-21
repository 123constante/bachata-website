# Brief: ONE fix pass on Website PR #938 (review nit N1)

Repo `123constante/bachata-website`, branch `claude/og-card-src-allowlist` (PR #938, head e56d1862). Push ONCE. Sonnet.

## What the review found
Independent review (verdict SHIP): `git fetch origin claude/review-og-card-src-allowlist` then
`git show FETCH_HEAD:docs/reviews/review-og-card-src-allowlist.md`, section N1. The site's own `/api/` paths are allowed
sources, so `/api/og/card?kind=image&src=https://www.bachatacalendar.co.uk/api/og/card?...` makes the endpoint call itself,
one function run per nesting level. The missing check: a refused test row for an own-origin `/api/` URL.

## Task (exactly this)
1. RED FIRST: add to `tests/ogImageSourceAllowlist.test.ts` refused rows
   `https://www.bachatacalendar.co.uk/api/og/card?kind=image&src=x` and `https://bachatacalendar.co.uk/api/og/bake`;
   run `npx vitest run tests/ogImageSourceAllowlist.test.ts` and record the failure.
2. In `app/lib/ogImageSourceAllowlist.ts`, after the PATH_PREFIX handling, refuse the two site hosts when
   `u.pathname.startsWith("/api/")` (the exact code is in review N1). Keep every other rule as is.
3. Re-run that test file plus `tests/ogCardFallbackMarker.test.ts`: green. Also `npm run build`.
4. Append both runs (command + result) to `docs/handover-og-card-src-allowlist.md`. Do NOT edit the PR body
   (`gh pr edit` fails with the bot token); the orchestrator copies it in.
N2 needs no change (review says so).

## Rules
Plain git only, never `gh api`. No variables/loops/`$(...)` where a plain command works. Never `--no-verify`.
GitHub Actions billing refusals are not code failures. Final commit subject ends `[worker-done <ticket>]`. Stop after the push.
