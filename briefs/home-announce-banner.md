# Brief: Website: home-page announcement banner, shipped OFF (owner decision 2026-10-15)

Repo `123constante/bachata-website`. Read FIRST `briefs/dancer-rebuild-COMMON.md` on `arc/briefs-dancer-rebuild`
(`git fetch origin arc/briefs-dancer-rebuild` then `git show FETCH_HEAD:<path>`). Then the repo's `CLAUDE.md`.
Plain git only, never `gh api`. Shell commands without variables, loops or `$(...)` where a plain command works.
Check a PRODUCTION build (`npm run build` + preview), not only the dev server.

BRANCH: `claude/home-announce-banner` from `main`. Open ONE PR as the bot (`GH_TOKEN` = the bot token in the
environment, `gh pr create` only; never `gh api`). Never merge.

## The owner's words / decision
The dancer area and organiser pages are launching in 3 waves (inner circle -> organisers -> all dancers). The owner
said YES to "a home-page banner" for the last wave. It must ship OFF and be switched ON later by changing one constant.

## What
- A small dismissible banner at the top of the home page content (`src/pages/Index.tsx`, the city calendar the site
  lands on): text "New: dancer profiles + organiser pages", a button "Create your profile" that goes to the existing
  dancer sign-up (read `src/pages/Auth.tsx` to find how a link opens sign-up mode, e.g. a query param; link to it,
  do NOT edit Auth.tsx), and a close (x) button with an accessible name "Dismiss".
- One constant `HOME_ANNOUNCE_BANNER_ON = false` in a new `src/lib/homeAnnounceBanner.ts` (with the text and link
  there too). OFF = nothing renders and no layout change at all.
- Dismiss is remembered per browser (localStorage key `home-announce-dismissed-v1`, wrapped in try/catch; if storage
  throws the banner still renders and dismiss still hides it for the visit).
- Phone first: 390x844 and 360x780, one or two lines, button >= 44 px tall, no sideways scroll, contrast >= 4.5:1,
  uses the site's existing colour tokens. Desktop: same banner, max width of the content column.
- Do not show it on any page other than the home calendar, and never inside `/app`.

## Tests (red first: quote the red run on main)
Unit: OFF renders nothing; ON renders text + link to the sign-up target; Dismiss hides it and writes the key; a
stored key hides it; storage throwing still works. Phone spec: ON at 390x844 (flip the constant in the test via a
prop/param, never by editing the constant in a test), measured button height and no horizontal overflow.

## Owned files
`src/lib/homeAnnounceBanner.ts`, a new `src/components/HomeAnnounceBanner.tsx`, the minimal mount in
`src/pages/Index.tsx`, their tests, `docs/review-packs/home-announce-banner/`. Do NOT touch `AppChrome.tsx`,
`BottomNav.tsx`, `index.css` (nav-top PR #761 owns them), `Auth.tsx`, `AuthCallback.tsx`, `src/lib/accountRouting*`,
`src/modules/dancer-app/**` (dancer routing worker owns them).

## Output
PR body: summary, `## Verified on real data`, `## Phone QA` (390x844 + 360x780 shots ON and OFF, prod-shaped data),
`## CI run in the worker sandbox` (every step of `.github/workflows/*` that runs on a PR: command, exit code).
GitHub Actions may be refused for billing ("payments have failed"); that is not a code failure.
Handover `docs/review-packs/home-announce-banner/HANDOVER.md`. Stop after the push and report.
