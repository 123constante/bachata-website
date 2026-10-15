# Brief: Website: move the public bottom bar to the top (owner decision 2026-10-15)

Repo `123constante/bachata-website`. Read FIRST `briefs/dancer-rebuild-COMMON.md` on `arc/briefs-dancer-rebuild`
(`git fetch origin arc/briefs-dancer-rebuild` then `git show FETCH_HEAD:<path>`). Then the repo's `CLAUDE.md`.
Plain git only, never `gh api`. Shell commands without variables, loops or `$(...)` where a plain command works.
Check a PRODUCTION build (`npm run build` + preview), not only the dev server.

BRANCH: `claude/site-nav-top` from `main`. Open ONE PR as the bot. Never merge.

## The owner's words
"Is it possible to put the bottom nav to the top, because it occupies finger space?" Offered hide-on-scroll; the
owner chose: MOVE IT TO THE TOP.

## What
The public site's `BottomNav` (`src/components/BottomNav.tsx`, rendered by `src/components/AppChrome.tsx:115`:
Organisers / Venues / Raffles / Community, incl. the Community WhatsApp badge) moves to a row directly under the
site header on phones, so nothing is fixed at the bottom of the screen any more.
- Same 4 links, same icons and badge, same active state. Compact: one row, each target at least 44 px tall, fits 360
  px wide without sideways scroll (measure 360 and 390). Sticky with the header if the header is sticky, otherwise
  scrolls with it; the two together must not take more than ~120 px at 390x844.
- Remove the bottom spacer that cleared the bar (`AppChrome` spacer, and the `index.css` ~line 1496 rule that pads
  pages for it) so pages end cleanly, and check every fixed-bottom element that sat above the bar (sticky Save bars,
  cookie banner, toasts, the festival/event sticky CTAs) now sits at the real bottom with safe-area padding.
- Desktop: keep whatever desktop does today (the home page hides it on desktop: keep that rule).
- `/app` (the dancer app, `modules/dancer-app/shell`) has its OWN chrome and bottom tabs: do not change it.
- Do NOT edit the header's person icon / account menu or `src/lib/accountRouting.ts`: another worker
  (`claude/dancer-app-routing`) owns those. If the header file must change for layout, touch only the layout lines and
  say so in the PR.

## Done means
- 390x844 and 360x780 screenshots (production build) of: home, an event page (with its sticky CTA), a festival page,
  organisers list, an old account page with a Save button: before (main) and after. Commit under
  `docs/review-packs/site-nav-top/`. Measured: scrollWidth = viewport width, every nav target >= 44 px, nothing
  overlaps the header row (`elementFromPoint` at each link centre returns that link).
- Existing tests updated; a test pins that BottomNav is not fixed to the bottom and renders under the header.
- Every CI job step from `.github/workflows` in your sandbox; per-job table in the PR body; bundle budgets green.
- PR body: before/after in plain words, Verified / Not verified.

Last commit subject ends `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at the 30% context limit).
Push, open the PR, stop.
