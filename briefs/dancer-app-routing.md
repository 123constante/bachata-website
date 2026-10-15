# Brief: Website: route signed-in dancers to the new /app (dancer area is now OPEN)

Repo `123constante/bachata-website`. Read FIRST `briefs/dancer-rebuild-COMMON.md` on `arc/briefs-dancer-rebuild`
(`git fetch origin arc/briefs-dancer-rebuild` then `git show FETCH_HEAD:<path>`): hard limits, CI-without-billing,
definition of done, PR as the bot, 30% context rule. Then the repo's `CLAUDE.md`. Plain git only, never `gh api`.
Shell commands without variables, loops or `$(...)` where a plain command works. Check a PRODUCTION build
(`npm run build` + preview), not only the dev server.

BRANCH: `claude/dancer-app-routing` from `main` (2260d46b = PR #759 merged, the /app area). Open ONE PR as the bot.

## Why (the owner's words, 2026-10-15)
The owner opened the dancer area to everyone at 14:05 UTC (`dancer_area_open` = true on prod). Then: "I just logged
in again and this is what appeared for my dancer profile. Why?" -- sign-in landed on the OLD dancer dashboard
(`/account` -> `accountHome()` -> dancer -> `OrganiserHomeDancer`, title "Your dancer profile"), not the new /app.
#759 deliberately left old pages untouched while /app was a closed beta; that is now wrong for dancers.
The check that would have caught it: a table-driven routing test over every account shape asserting where sign-in,
the header person icon and the account menu land.

## Owner-approved workflow (2026-10-15, click answers; do exactly this)
Principle: one "your profiles" list is the single source of truth (extend `src/lib/accountRouting.ts`; reuse the
organiser facts `Account.tsx` already reads: `fetchOrganiserHome`, `organiserHomeQueryKey`, open requests). The
chooser, the switcher and every redirect read that one list. Sides today: each organiser the person runs (one entry
per organiser), and their dancer profile. Organisers are the PRIORITY: always listed first.
1. An explicit `returnTo` (a link the person followed) always wins: no chooser.
2. ONE side only -> straight there after sign-in: dancer -> `/app`; organiser-only -> organiser home as today.
3. TWO OR MORE sides -> after sign-in, a "Continue as..." screen: one large button per side (organiser buttons first
   and visually primary: logo + organiser name + "Organiser"; then face + first name + "Dancer"). One tap goes there
   (an organiser button opens the organiser home for THAT organiser if the organiser area supports it, else the
   organiser home). Shown on EVERY sign-in (no "remember" option). Never shown to single-side people.
4. SWITCH ANY TIME: the top-right picture/person icon, on every /app screen AND the organiser area, opens the same
   "Switch profile" sheet: every side with a tick on the current one, then "Account settings" and "Sign out". One
   tap switches. ONE shared component used in both areas. Single-side people see their one side (no switching UI
   noise) plus settings and sign out.
5. The old dancer home (`/account/dancer`, and `/account` when it resolves to "dancer") redirects to `/app` (replace).
6. NEW SIGN-UP: role "dancer" (default) -> `/app` (its onboarding handles a new profile); organiser roles -> organiser
   onboarding exactly as today.
7. A dancer who is not an organiser: a quiet "Run events? Become an organiser" row in /app Options that starts
   today's organiser request flow (not on Home).
8. ADMIN-ONLY (no dancer profile, no organiser): unchanged.
- Account settings (`/account/settings`: email, export, delete) stay reachable from /app Options (check; add the row
  if missing). `AuthStepper.tsx:169 navigate("/profile")` and `ProfileEntryFlow.tsx` "/profile" buttons: route dancers
  to `/app` the same way (find every post-sign-in/sign-up destination: `Auth.tsx:83` default returnTo, auth callback,
  AuthStepper, ProfileEntryFlow, AuthPromptModal).
- `/app` while the gate is open needs nothing new; if the gate were closed again, a non-listed dancer must still reach
  the old dancer home (do not strand them): make the /app redirect from the old dancer home conditional on the person
  being able to enter /app (reuse #759's gate check).

## Tests and checks (definition of done)
- Table-driven test over shapes x entry points: shapes = dancer complete, dancer incomplete, signed-in with no dancer
  profile, organiser-only, organiser+dancer, TWO organisers + dancer, open organiser request, admin-only, gate closed
  + not listed; entry points = sign-in with no returnTo (chooser or straight), sign-in with returnTo, sign-up dancer,
  sign-up organiser, each chooser button, the switcher in /app and in the organiser area, old `/account/dancer` URL. ONE shared mapping in accountRouting; the test reads it. Run it RED on main first (quote it).
- No text points at a control that is not on screen; the switch sheet shows only the sides the person really has; the chooser never appears for a single-side person.
- 390x844 walk (Playwright against the production build, mocked backend shaped like prod: 12 dancer-only, 3
  dancer+organiser, 2 admin-only accounts): screenshots of sign-in landing for a dancer-only person,
  the "Continue as..." chooser (1 org + dancer, and 2 orgs + dancer), the switch sheet open in /app and in the
  organiser area, /app Options with the "Become an organiser" row, the old /account/dancer redirect. Commit them under
  `docs/review-packs/dancer-app-routing/`. scrollWidth 390, no control under 44 px.
- Every CI job step from `.github/workflows` in your sandbox; per-job table in the PR body. Bundle budgets must stay
  green (event page budget and the /app area budget from #759).
- PR body: before/after in plain words, the workflow table above, Verified / Not verified.

Last commit subject ends `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at the 30% limit). Push, open
the PR, stop. Never merge. Out of scope: any database change; organiser screens change ONLY by gaining the shared switcher in their header.
If the work will not fit your context, ship in this order and leave the rest as "## Left": (1) routing + redirect +
tests, (2) chooser, (3) switcher in /app, (4) switcher in the organiser area, (5) Options row.

Another worker (branch `claude/site-nav-top`) is moving the public BottomNav to the top: do NOT edit
`src/components/BottomNav.tsx` or the BottomNav/spacer parts of `src/components/AppChrome.tsx`.
