# Brief: ONE fix pass on PR #789 from the signed-in walk (2 bugs + 1 observation)

Repo: 123constante/bachata-website. Branch `claude/dancer-journey-fixes` (PR #789), head `987a5e59`. Model: Opus.
You are the only worker on this branch. Push ONCE at the end (a Vercel preview build is expected for this push; none before it).

## Read first
`git fetch origin claude/done-walk-789` then `git show FETCH_HEAD:docs/review-packs/dancer-journey-fixes/WALK.md` (bugs list, with screenshots
`shots/options--no-profile.jpg`, `shots/home--no-profile.jpg`). Also `docs/handovers/dancer-journey-fixes.md` on the PR branch.

## The failure the owner would see (plain words)
A person who has an account but NO dancer profile (and an organiser who has no dancer side) opens the dancer app Options screen and
sees only "We could not find your dancer profile. Message us" and a WhatsApp button. There is no Sign out and no way to Account settings.
They are trapped on that screen. Also the little "Home / Your account / Account settings" links on the settings and delete pages are only 17 px high,
too small to tap on a phone.

## Orchestrator decisions (already made, do not re-open)
1. Bug 1 (design): on `/app/options` AND `/app/home`, for a signed-in person with no dancer profile, KEEP the "message us" text, and ADD below it
   (a) a link/button "Account settings" (-> `/account/settings?from=app`), (b) the same "Sign out" control the full Options screen uses (reuse it, one
   shared component, not a copy; sign-out must still land Home and clear local data), and (c) ONLY if the person is an organiser (has an organiser side):
   a link "Go to my organiser area" (-> `/account/o`). All tap targets >= 44 px high. This also resolves WALK Observation A.
2. Bug 2: make the three breadcrumb links on `/account/settings` and `/account/settings/delete` at least 44 px high (explicit px, e.g. `min-h-[44px]`
   with inline-flex items-center; keep the visual look close to today). Do NOT touch the organiser area (`/account/o`) footer links: not in #789's scope.
3. Observation B (avatar differs between organiser area and dancer app): leave as is. Observation C (3 s cap): leave as is.
4. Merge `origin/main` into the branch first (it is 2 behind: #797 settings only, no conflict expected). Keep every line of both sides.

## Gates
- RED-FIRST: write table-driven tests (shape x control) that FAIL on the current head: for every dancer-app shape in `DANCER_SHAPES` incl. no-profile and
  organiser-without-dancer, assert Options and Home each expose a Sign out control and an Account settings link, and that a no-profile page never points at a
  control that is not on screen. Add a test that the three breadcrumb links are >= 44 px in the phone-qa project. Show them failing on the unfixed code, then passing.
- Run EVERY CI job step in `.github/workflows` that this diff touches, with a per-job table (command, exit code) in the PR #789 body and the handover.
  GitHub Actions may be refused by billing: then your table is the evidence. Also `npm run build` (production build) and the phone-qa + build-smoke projects at 390x844.
- Chunk pins / bundle budget: keep dancer-app within the existing budget (363 KB / 57 chunks); if you must raise a pin, say so and why.
- Update `docs/handovers/dancer-journey-fixes.md` (Done / Left / Next) and the PR #789 body `## Verified on real data` line: "Signed-in walk by worker on test
  accounts: see docs/review-packs/dancer-journey-fixes/WALK.md on claude/done-walk-789; bugs 1 and 2 fixed by <your head sha>".
  (`gh pr edit 789 --body-file ...` as the bot is fine; NEVER `gh api`.)

## Rules
- Plain git for read and push. Shell commands without variables, loops or `$(...)` where a plain one works.
- Never merge or approve. Never `--no-verify`. No Supabase needed. Bot-authored PR stays as is.
- Context: at 25% start nothing new; by 30% push what is safe as `PARTIAL [worker-done <ticket>]` with a handover of what is left.
