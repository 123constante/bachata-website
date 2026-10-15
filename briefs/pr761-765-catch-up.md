# Brief: bring a PR up to date with main and make its CI green (one PR per worker)

Repo: 123constante/bachata-website. Your dispatch prompt names ONE branch: #761 `claude/site-nav-top` OR #765
`claude/home-announce-banner`. Push to that branch only. Another worker does the other one; do not touch it.

## Task
1. `git merge origin/main` into your branch (a merge commit; never rebase, never force-push). Resolve conflicts keeping
   main's behaviour plus this PR's change.
2. Make every CI job green that a code change can fix. Known reds on the old heads:
   - #761 (786930a5): `dancer-area-isolation` 32 violations; `real-data-verified`.
   - #765 (93212629): `dancer-area-isolation` 5 violations; `phone-qa` (tests/phone-qa announce-banner specs:
     "banner OFF nothing rendered" and "scroll / dismiss sticks", at 390x844 and 360x640); `phone-qa-section` and
     `real-data-verified` (PR body sections missing).
   Re-run the isolation check after the merge first (main may already have changed its allowlist). Fix real
   violations in the code (do not widen the allowlist unless main's own rules say the file belongs there; say why).
   For phone-qa: find the real cause (read the failure screenshots/trace); fix the code or the spec, and say which and why.
3. Write `docs/review-packs/<branch-name-without-claude/>/PR-BODY.md` with the sections "## Phone QA" and
   "## Verified on real data" written so `scripts/check-pr-phone-qa.mjs` and the real-data check pass on it (run both
   scripts against the file), and a `HANDOVER.md` next to it (done / per-job table / Verified / Not verified).
   The orchestrator copies PR-BODY.md into the PR.

## Gates (CI without paying GitHub)
Billing annotations ("payments have failed / spending limit") are not code failures. Run every pull_request job step in
`.github/workflows/` your sandbox can run (unit tests in the 3 timezones, typecheck, lint, isolation, integrity,
phone-qa, build-smoke, `npm run build` PRODUCTION build); per-job table (command, exit code) in HANDOVER.md.

## Rules
- Plain git for read and push. NEVER `gh api`, never `gh pr edit`.
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge a PR or approve. Never `--no-verify`. Supabase READ-ONLY.
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.
