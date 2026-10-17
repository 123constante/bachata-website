# PR #764 body (copy into the PR description)

## Decided for the owner (orchestrator defaults, logged)
- **M76:** every sign-out path clears all person-scoped storage keys (the owner also decided this as D1).
- **M10/M24:** onboarding ends use replace, so Back never re-opens "You're in".
- **M71:** a finished dancer on `/app/welcome` sees the end card and is never asked again.
- **M80:** unchanged. Pinned by the two-tabs spec.
- **M17:** as the code says. An admin-only account is sent through the dancer setup to open the organiser area.
- **Build-smoke:** the config owns its build (brief step 0).
- **M60:** the banner spec is held back until #765, rather than shipping a spec that is red forever on this branch.
- **perf:** the `/app/*` budget goes from 360 to 361 KB (+0.4 KB measured), following the file's own rule.
- **D1 (privacy default):** unsaved organiser and vendor drafts are cleared on sign-out.
- **perf:** `/app/*` budget 360 -> 361 KB (+0.4 KB measured).


## Phone QA

Sizes checked: 390x844 (production build walk, every journey row and account-edge spec) and 390x844 + 360x640 (phone suite)
Walked: all 32 public journey rows (13 new: Back on each onboarding card, magic link on a second device, unfinished/organiser/open-request people opening the organiser link, existing dancer on the dancer link, sign-in with an unfinished dancer + organiser, sign-in with an open request, team invite for existing and unfinished dancers, old /app/welcome and /finish-profile bookmarks) plus the account-edge specs (a different organiser signing in after A on the same phone, sign out then a different person on the same phone, sign out in another tab, two organisers in the switch sheet, admin-only in /app, two tabs mid-onboarding, invite opened by a different signed-in person) in the production build with the fake backend; phone suite 174 passed
Not verified: a real phone, a real inbox (magic link / OTP), real Supabase auth, the home banner (PR #765), Lighthouse/preview checks

## Verified on real data

Shapes surveyed: read-only prod counts (MATRIX.md "Prod shapes", 2026-10-15): 20 accounts; 7 unfinished dancers, 7 finished dancers, 4 dancer + 1 organiser (1 with an unfinished dancer profile = the M35 shape), 0 with 2+ organisers, 1 open organiser request, 2 admin-only, 0 accounts with no dancer row and no organiser (M44), 4 team invites issued (1 open), 0 dancer invites, 0 erase requests
Checks run: every one of those shapes is a journey row or account-edge spec walked in the production build at 390x844 and in the routing model (vitest); red-first on the unfixed code for each new decision; every runnable pull_request CI job locally (table above)
NOT verified: real Supabase auth and OTP e-mail (needs owner: E2E Supabase credentials), a real phone, M44 onboarding for a row-less account (blocked, see open items), live-DB contract suites (secrets), GitHub Actions runs on this head
