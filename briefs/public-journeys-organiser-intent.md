# Brief: Website: public journey map + organiser-link sign-up fix + every journey walked (owner rule 2026-10-15)

Repo `123constante/bachata-website`. Read FIRST `briefs/dancer-rebuild-COMMON.md` on `arc/briefs-dancer-rebuild`
(`git fetch origin arc/briefs-dancer-rebuild` then `git show FETCH_HEAD:<path>`). Then the repo's `CLAUDE.md`.
Plain git only, never `gh api`. Shell commands without variables, loops or `$(...)` where a plain command works.
Check a PRODUCTION build (`npm run build` + `vite preview`), not only the dev server.

BRANCH: `claude/dancer-app-routing` (PR #764, already open, bot). Continue ON it: `git fetch origin
claude/dancer-app-routing` and check out its head (e1a0df8e or later). Push to the same branch; the PR updates itself.
Never open a second PR, never merge, never `--no-verify`.

## The failure the owner saw (owner's words, 2026-10-15)
The owner opened the organiser launch link
`https://www.bachatacalendar.co.uk/auth?mode=signup&userType=organiser&returnTo=%2Faccount%2Fo`, signed up with a new
e-mail, entered the code, was asked for a picture, and ended in the DANCER app ('Dancer' badge, Profile strength 70%,
'How long have you been dancing?', tabs Home/Nights/Me/Options), never at the organiser page. Then: "Why am I having to
check these processes? You should be the professional and work them out... You need to create all of the workflows,
not me." The check that would have caught it: a table-driven test with one row per public entry link that drives the
link to its END screen, plus a walk of each row at 390x844.

## Owner decision (binding)
Organiser-link sign-up = the FULL dancer setup (required + optional questions, photo step included), THEN land on the
organiser 'claim your page' screen (`/account/o`, its OnboardingView). Not "skip to claim". The dancer link is
unchanged (ends on the dancer home `/app`).

## Task 1: the journey map (write it before code)
`docs/journeys/public-entry-journeys.md`. Find EVERY public way into an account, by reading the code, not guessing:
grep for links to `/auth`, `mode=signup`, `userType=`, `returnTo=`, the home banner (`src/lib/homeAnnounceBanner.ts`
on PR #765 if not on main), e-mail templates / invite and claim links (organiser team invite, claim organiser, any
`emailRedirectTo`), the header/nav sign-in button, `/account/*` and `/app/*` deep links when signed out. For each
journey one row: entry URL -> each step (screen name + what the person does) -> END screen + expected state (which
role rows exist, where a reload lands, where Back goes). Cover at least: organiser link (new e-mail), dancer link (new
e-mail), plain Sign in for an existing dancer / existing organiser / person with both sides, signed-IN person opening
the organiser link, a person who reloads or closes the tab half way through onboarding and comes back, the e-mail code
opened in a different tab or browser, a wrong/expired code, the banner button. Where the code has no answer, decide the
default yourself from the owner decision above (the person never ends on a dead end; organiser intent is never
silently dropped) and list each such default under "Decisions made by the worker" at the end of the doc.

## Task 2: the fix
Carry the organiser intent (`userType=organiser` and the `returnTo`) through sign-up, the e-mail code step and the
whole `/app` onboarding, and at the END of the dancer flow send the person to `returnTo` (`/account/o`) instead of the
dancer home. It must survive: the code step, a reload mid-onboarding, the magic link opened in the same browser.
Use the routing PR's existing rules ("explicit returnTo always wins", "organiser roles -> organiser onboarding") and
its one routing model in `src/lib/accountRouting.ts`; do not add a second copy of the routing decision. Only allow
same-site relative `returnTo` paths (no open redirect; test a hostile value).

## Task 3: tests (red first)
One table-driven spec whose rows ARE the journey map rows (import or mirror the row list in one place), unit level on
the routing model plus a production-build Playwright spec at 390x844 with mocked auth/OTP that drives each row to its
end screen. Run the organiser row against the UNFIXED head e1a0df8e first and quote the red output in the PR body.

## Task 4: walk every journey yourself
Production build, 390x844 (and 360x780 for the organiser row), prod-shaped data (read-only Supabase MCP for shapes;
counts only, no personal data). One screenshot per step into `docs/review-packs/public-journeys/<row>/NN-<step>.png`,
plus `docs/review-packs/public-journeys/WALK.md` (row, step, what you saw, pass/fail). The OTP may be mocked in the
sandbox; say so. The orchestrator will repeat the organiser and dancer rows on the real site with a real inbox.

## Owned files
Everything PR #764 already touches, plus the onboarding screens under `src/modules/dancer-app/**`, `src/pages/Auth*.tsx`,
`docs/journeys/**`, `docs/review-packs/public-journeys/**`, their tests. Do NOT touch `AppChrome.tsx`, `BottomNav.tsx`,
`index.css` (nav-top PR #761), `src/lib/homeAnnounceBanner.ts` / `HomeAnnounceBanner.tsx` (banner PR #765), the
legal pages (PR #762). If one of those must change, write it in the handover instead.

## Output
Update PR #764's body (keep what is there): add `## Journey map` (link), `## Red first` (quoted), `## Verified on real
data`, `## Phone QA` (the WALK.md table), `## CI run in the worker sandbox` (every step of `.github/workflows/*` that runs
on a PR: command, exit code; GitHub Actions may be refused for billing: "payments have failed" is not a code failure).
Use `gh pr edit 764 --body-file <file>` as the bot. Handover `docs/review-packs/public-journeys/HANDOVER.md`.
Stop after the push and report.
