# Brief: phone-size walk of Website PR #913 on real data (measure only, no code change)

Repo `123constante/bachata-website`. PR #913, branch `claude/ended-event-cls`, head **c31bbea5**. You do NOT change
that branch. You push your report to YOUR OWN branch `claude/walk-ended-event-cls` (create it from `main`).

## Why
The owner saw an ended event's page jump while the organiser "door" (MoreEventsSection) filled in late. #913 prefetches
the door on the server (1.5 s budget) and, after review, no longer caches a failed door fetch as "empty". The
orchestrator must walk the change at phone size on real production data before the owner merges. Its own PC ran out of
memory building it, so you do the walk.

## Task
1. `git fetch origin claude/ended-event-cls` and check out **c31bbea5** (detached). `npm ci`.
   Production build (`npm run build`) with the PRODUCTION Supabase URL and anon key from your environment
   (the earlier review worker did a "prod-key build"; read-only, the anon key only reads public data).
   If no prod key is available, STOP and report "needs owner: prod anon key in the cloud env"; do not fake data.
2. Serve it with `node scripts/_serve-build.mjs` (production server, as the earlier review used).
3. Headless Chromium (Playwright) at **390x844** (and 360x640), CPU throttled 4x via CDP, 7 s settle.
   For each of these ended events: `/event/the-camden-tuesdays`, `/event/bachata-pasos-libres`, plus ONE more ended
   event you pick from prod (read-only SELECT; an ended, non-festival event whose organiser has other live events):
   - CLS (layout-shift entries, sum without recent input);
   - whether the organiser door section is in the first server HTML (view-source) and visible after load;
   - the bento grid's first tile top before and after load (px moved);
   - a 390x844 screenshot after settle, committed as PNG under `docs/reviews/walk-ended-event-cls/`.
4. Do the same 3 measures on **unchanged main** (`origin/main`) for the same slugs, so the report shows before/after.
5. One fault case on the PR build: make `get_organiser_event_counts` fail (a preload or request route returning 500, as
   the review's S1 fault injection did) for `bachata-pasos-libres`, and record whether the door appears after hydration
   (it should: the failure is no longer dehydrated as empty).

## Report
`docs/reviews/walk-ended-event-cls.md` on `claude/walk-ended-event-cls`: a table (slug x viewport x main vs PR:
CLS, door in SSR HTML yes/no, grid move px), the fault case result, the screenshots list, the exact commands, and
Verified / Not verified (e.g. real phone, real network). Plain words, short.

## Boundaries
- Plain git only (`git fetch`, `git show`, `git push`). Never `gh api`. No PR needed; do not open one.
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Supabase: SELECT only. Never merge, approve, or push any branch but `claude/walk-ended-event-cls`. Never `--no-verify`.
- One push at the end. `claude/*` branches build no Vercel preview (expected).
- 30% context limit: at 25% start nothing new; by 30% push what you have with a subject ending
  `PARTIAL [worker-done <ticket>]`.
- Last commit subject ends `[worker-done <ticket>]`. Stop after the push.
