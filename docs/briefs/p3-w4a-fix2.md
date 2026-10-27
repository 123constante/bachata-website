# Brief: P3 W4a FIX 2 (continuation on PR #1080, branch claude/p3-w4a-team-switch-page)

Continue on `claude/p3-w4a-team-switch-page` (fetch it; head 3319e20; do NOT restart). Normal lane, no DB, no Supabase writes. Context cap 30%: push early.

1. CI `bundle-budget` is RED: `dancer-app (/app/*, lazy chunk via catchall): 374.2 KB first-load JS across 49 files (budget 374 KB)`. Your lazy-load of the R1 screens (2ccf97f) was not enough. Get under budget without raising any budget, puller or chunk allowance (check how `claude/p3-w3a-details` commit 46e4efc moved its screens out of /app's route table). Run `npm run check:bundle-budget` and `check:chunk-cycles` on a fresh build until green.
2. `contract-check` is red on main too (admin-repo drift): leave it, confirm it is the same failure as main and say so in the PR body.
3. Re-run every other CI job step that applies; put a per-job table and Verified / Not verified in the PR #1080 body; update `docs/handover/p3-w4a-phase-b.md`.
4. Open follow-up the owner already decided: nothing new. Do not touch the Done-screen (R1 look) item; it stays queued.

Push once coherent (subject ends [skip preview]); final push ends `[worker-done dt_<ticket>]` with NO [skip preview].

## 5. Orchestrator re-walk of head 3319e20 at 390x844 found three defects (fix with tests, red first)
Walk pictures were read by the orchestrator; the walker's own numbers agree.
a. `/account/p3/you/page`: the organiser NAME is invisible. The pencil under the avatar has no name beside it, and the walker measures "test org" at contrast 1:1 (need 3). The name text takes the same colour as the card behind it in the P3 frame (an R1 token that P3 does not define, or white-on-white). Make it readable in light and dark, and add a contrast assertion for the name on this screen.
b. Same screen: the top of the card is clipped under the sticky P3 header (the card's top edge starts above the viewport line at y about 112 of 844). Give the pushed shell content proper top padding so the first card is whole.
c. `/account/p3/you/switch`: "Add a page" is plain orange text on cream, contrast 2.69 (need 4.5). Use the terracotta link token like the other P3 text links, at a 44px tap height.
