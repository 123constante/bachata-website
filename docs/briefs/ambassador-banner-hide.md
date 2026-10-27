# Hide the dancer-profile banner on /ambassador (owner pick A, 2026-10-27)

Branch `claude/ambassador-banner-hide` off `main`. Fast-sized change: at most 3 files, under 80 lines.

Design record: `docs/design/ambassador-a1-banner.md` on branch `claude/ambassador-a1-banner-mockups` (option A). Link it in the PR body and copy it to `docs/design/ambassador-banner-hide.md` on this branch (trim to the brief, option A, the measurements table, Not verified).

Change: add `/ambassador` and everything under it to `BANNER_HIDDEN_ON` in `src/lib/profileCompletion.ts` (follow the file's existing matching style, so `/ambassador` and `/ambassador/...` both hide it, but NOT `/ambassadors-x`). Add rows to the existing banner tests for: `/ambassador`, `/ambassador/review/abc`, `/ambassador/`, and a negative row (`/ambassadors`, `/organisers`) that still shows. Run red first against unfixed code, then green. Do not touch the banner component, perf-budgets.json or vite.config.ts. Run related unit tests, lint, tsc. One push. Honest Verified / Not verified. Do not merge.
