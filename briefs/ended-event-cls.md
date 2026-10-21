# Brief: ended-event-cls (Website fix)

Ticket branch: `claude/ended-event-cls` (off `main`). Repo: 123constante/bachata-website (public;
deploys on push to main via Vercel). Model: Opus. Plan: author (+ optional continuation) + independent
review + ONE fix pass. Continuation, if any, reads `docs/handover-ended-event-cls.md` on this branch.

## The problem (what the orchestrator saw)
During the live check of PR #878 (hydration #421 fix, 2026-10-20) at 390x844 with CPU 4x slowdown,
the page of an ENDED event (`/event/<id>`) shifted its layout at about 3.5 s after load:
cumulative layout shift about 0.12 (Google's "good" limit is 0.1). Live events were fine. The same
shift happens on main before #878, so it is pre-existing and not caused by that PR.
Prod shapes: event_series_p5 lifecycle_status = ended: 21 series (all with ended_on set);
live 67, archived 653, paused 2, draft 2. Also check a live series whose dates are ALL in the past.

## Owner decision
Fix it (owner, 2026-10-21, click question). No design change beyond what stops the shift: reserve the
space the late content needs, or render it in the first paint; do not hide content to win the score.

## The task
1. RED FIRST: find the element that moves. Use a PerformanceObserver for `layout-shift` entries and
   log `entry.sources` (node, previousRect, currentRect) on a real ended event page, production build
   (`npm run build` then preview, or the live site), 390x844 and 360x640, CPU throttled. Name the
   component and the late data/asset that causes it (lazy chunk, image without size, late RPC,
   font swap, a Suspense fallback with a different height, ...).
2. Add a phone-size e2e check (Playwright, 390x844 and 360x640) that loads an ended event page and
   fails when the CLS after load is >= 0.1 or the named element moves. Show it FAILING on unfixed
   main (paste the number) and passing after the fix. If the e2e cannot reach prod-shaped data in
   CI, follow how tests/e2e/event-hydration-421.spec.ts handles it (local-only skip) and say so.
3. Fix the cause in the smallest way. Keep live-event pages unchanged (check one live event and one
   festival page before/after: CLS must not get worse).
4. `npm run build` must pass; run every CI job step from .github/workflows in your sandbox with
   command + exit code (the Website repo is public, so its Actions are free and should also run).

## PR body must have
What changed (before/after in plain words), the element and cause, red-first numbers, `## Phone QA`
(viewports, measured CLS before/after on ended + live + festival pages), `Effect on requests
reaching Vercel` if you touch images/caching/headers/router, per-job CI table, Verified / Not verified.

## Boundaries
- Read and push with PLAIN git; never `gh api`. Commands without variables/loops/`$(...)` where a
  plain one works.
- Push ONCE at the end (each push costs a Vercel build, shared cap ~100/day). PARTIAL push only at
  the 30% context limit.
- Open the PR with `gh pr create` using GH_BOT_TOKEN; never the GitHub MCP create tool.
- Supabase prod is READ-ONLY. Never merge or approve, never `--no-verify`.
- Another worker is on the ADMIN repo (media host swap); it does not touch this repo.

## Output
PR titled `fix(event): no layout shift on ended event pages`; write
`docs/handover-ended-event-cls.md` (done / left / next). Stop after the push and report.
