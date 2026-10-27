# Session handover: P3 W4a PR #1080 watch (2026-10-27)

Branch `claude/p3-w4a-team-switch-page`, PR #1080 (draft; the owner converted it, do not mark it ready).
Session: Phase A worker (ticket dt_54c8895e4544), then watching the PR's CI.

## Done
- Phase A design: `docs/design/p3-w4a.md`, `mockups/p3-w4a/{A,B,C}.html` (`e724087`).
- `773c0ad`: two raw Unicode punctuation marks in `p3/you/youRows.ts` became `\u` escapes (consistency.matrix G3 red).
- `2ccf97f`: the R1 screens the You hub pushes are lazy in `P3Routes`, with a P3-frame `Suspense` fallback.
  The static imports had put their chunks in `AnimatedRoutes`' preload list (+217 B gz on `/app/*`).
- One PR comment (issue comment 6446490562) keeps the live status of every red check; edit it, do not add new ones.

## State at `53bc357` (19:42 UTC)
- Green: bundle-budget, real-data-verified, phone-qa-section, integrity, unit (New York, Sydney), and the rest.
- Running: unit (Europe/London, full), e2e-smoke, phone-qa, build-smoke.
- Red, not this PR's: `contract-check`. It reads prod DB state and is red on `main` too:
  - 1 unmigrated structural DDL change on prod;
  - `check_occurrence_delete_booking_safety_v1` missing (PGRST202);
  - og_render bake POST returning HTTP 403 (Vercel challenge).
  The first two need an admin-repo (`bachata-admin-11april`) migration; the third needs the WAF/firewall-drift fix.
- `main` was red on Perf Budget from `dd8112f` (#1056, dancer-app 374.1 KB > 374). This PR is now under budget anyway.

## Next
1. Read the results of the four running checks on the current head. Fix only what this PR's diff causes.
2. Several sessions push to this branch: always `git fetch` and merge before a push (never force).
3. Do not merge, approve or mark ready.
