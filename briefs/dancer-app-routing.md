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

## Owner-approved workflow (do exactly this)
An explicit `returnTo` (a link the person followed) always wins.
- DANCER (no organiser, no open organiser request): after sign-in and from the header person icon -> `/app`.
  The old dancer home (`/account/dancer`, and `/account` when it resolves to "dancer") redirects to `/app`
  (replace, keep search/hash only if /app uses them).
- ORGANISER (claimed organiser or open organiser request; today all such people are also dancers): after sign-in ->
  organiser home exactly as today. The account menu's dancer entry ("My dancer profile" or whatever it is called)
  opens `/app`. In /app (Me or Options), an "Organiser tools" row/link to the organiser home, shown ONLY to organisers
  (reuse the same organiser facts/query `Account.tsx` uses: `fetchOrganiserHome`, `organiserHomeQueryKey`; no second
  copy of the rule -- extend `src/lib/accountRouting.ts`, the one owner of this decision).
- ADMIN-ONLY (no dancer profile, no organiser): unchanged.
- NEW SIGN-UP: role "dancer" (the default) -> `/app` (its onboarding handles a new profile); organiser roles ->
  organiser onboarding exactly as today.
- Account settings (`/account/settings`: email, export, delete) stay reachable from /app Options (check; add the row
  if missing). `AuthStepper.tsx:169 navigate("/profile")` and `ProfileEntryFlow.tsx` "/profile" buttons: route dancers
  to `/app` the same way (find every post-sign-in/sign-up destination: `Auth.tsx:83` default returnTo, auth callback,
  AuthStepper, ProfileEntryFlow, AuthPromptModal).
- `/app` while the gate is open needs nothing new; if the gate were closed again, a non-listed dancer must still reach
  the old dancer home (do not strand them): make the /app redirect from the old dancer home conditional on the person
  being able to enter /app (reuse #759's gate check).

## Tests and checks (definition of done)
- Table-driven test over shapes x entry points: shapes = dancer complete, dancer incomplete, signed-in with no dancer
  profile, organiser+dancer, open organiser request, admin-only, gate closed + not listed; entry points = sign-in with
  no returnTo, sign-in with returnTo, sign-up dancer, sign-up organiser, header icon, account menu dancer entry, old
  `/account/dancer` URL. ONE shared mapping in accountRouting; the test reads it. Run it RED on main first (quote it).
- No text points at a control that is not on screen; the "Organiser tools" row is absent for non-organisers.
- 390x844 walk (Playwright against the production build, mocked backend shaped like prod: 12 dancer-only, 3
  dancer+organiser, 2 admin-only accounts): screenshots of sign-in landing for a dancer and for an organiser, /app
  Options with and without "Organiser tools", the old /account/dancer redirect. Commit them under
  `docs/review-packs/dancer-app-routing/`. scrollWidth 390, no control under 44 px.
- Every CI job step from `.github/workflows` in your sandbox; per-job table in the PR body. Bundle budgets must stay
  green (event page budget and the /app area budget from #759).
- PR body: before/after in plain words, the workflow table above, Verified / Not verified.

Last commit subject ends `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at the 30% limit). Push, open
the PR, stop. Never merge. Out of scope: any database change, any change to organiser screens beyond the menu link.
