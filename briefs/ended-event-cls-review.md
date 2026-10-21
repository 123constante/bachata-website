# Brief: independent review of Website PR #913 (ended-event-cls)

Review branch: `claude/review-ended-event-cls` (docs only). Repo 123constante/bachata-website.
You are NOT the author. Read-only on the code under review: do not change `claude/ended-event-cls`.
Model: Opus. Your findings go to ONE fix worker afterwards, so be concrete (file, line, failing case).

Read first: the author brief `briefs/ended-event-cls.md` (same brief branch), the PR head
`git fetch origin claude/ended-event-cls` (head b87e817f; files: `app/routes/event.tsx`,
`src/modules/event-page/sections/MoreEventsSection.tsx`, `tests/e2e/event-ended-cls.spec.ts`,
`package.json`, `docs/handover-ended-event-cls.md`).

## The problem and the owner decision
On an ENDED event page (`/event/<id>`), at 390x844 with CPU 4x slowdown, the layout jumped about
3.5 s after load (CLS about 0.12, limit 0.1). The author found the cause: the organiser "door"
(`MoreEventsSection` with blocks=[organiser]) fills in late on ended series. The fix prefetches it in
the SSR loader of `app/routes/event.tsx` with a 1.5 s budget (`ENDED_DOOR_BUDGET_MS`).
Owner: fix it, no design change beyond what stops the shift, never hide content to win the score.

## Check, with evidence
1. Cause: re-measure on a production build (`npm run build`, then preview against prod read-only
   data) with a PerformanceObserver on `layout-shift` sources, ended event, 390x844 and 360x640, CPU
   throttled. Is the door really the element that moved, and is the shift gone after the fix?
   Paste the numbers before/after.
2. The budget: what happens when the prefetch takes longer than 1.5 s (slow DB) or errors? Does the
   page still render, does the door still appear later, and does the shift come back in that case?
   Is the server response time for EVERY event page (live too) now slower? Measure TTFB before/after
   on one ended, one live and one festival page.
3. Scope: the prefetch must run only where needed (ended series). Live events, a live series whose
   dates are ALL past, festivals, cancelled: unchanged? Prod shapes: event_series_p5 lifecycle_status
   ended 21, live 67, archived 653, paused 2, draft 2 (verify read-only, counts only).
4. Hydration: server and client render the same door (no React #418/#421 mismatch; read
   tests/e2e/event-hydration-421.spec.ts). Any double fetch on the client after the prefetch?
5. Cache/requests: does the change add Supabase calls per page view or change cache headers?
   Effect on requests reaching Vercel.
6. The e2e spec: does it fail on unfixed main (run it against main in your sandbox) and pass on the
   head? Is it skipped in CI (why, and is that acceptable per the hydration-421 precedent)? Why the
   `package.json` change?
7. PR checks `phone-qa-section` and `real-data-verified` are red: read those workflows and say what
   the PR body is missing (the orchestrator fills real-data verification itself; say exactly which
   section text each check needs).
8. Every CI job step from .github/workflows: run it in your sandbox, table with command + exit code.

## Output
Write `docs/reviews/review-ended-event-cls.md` on `claude/review-ended-event-cls`: verdict
(SHIP / FIX FIRST), findings each with severity (blocker / should / nit), evidence, and the exact fix.
Push ONCE with plain git (each push costs a Vercel build), last commit subject ending
`[worker-done <ticket>]`. No PR needed. Never merge/approve, never `gh api`, never `--no-verify`.
Prod Supabase SELECT-only. Commands without variables, loops or `$(...)` where a plain one works.
At 25% context start nothing new; by 30% push what you have with a subject ending
`PARTIAL [worker-done <ticket>]`. Stop after the push and report.
