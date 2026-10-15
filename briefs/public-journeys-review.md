# Brief: Website: independent review of PR #764 (claude/dancer-app-routing @ 4f0c8e2), read-only

Repo `123constante/bachata-website`. Read `CLAUDE.md`, then on branch `claude/dancer-app-routing`:
`docs/review-packs/public-journeys/HANDOVER.md`, `docs/journeys/public-entry-journeys.md`, `docs/review-packs/dancer-app-routing/`
handover if present. Plain git only, never `gh api`. Shell commands without variables, loops or `$(...)` where a plain
command works. Supabase connector READ-ONLY.

You did NOT write this code. Review `git diff origin/main...4f0c8e2 -- src scripts` like `/code-review low`: correctness
bugs only, each with file:line, a concrete failure scenario and a verdict (CONFIRMED by reading or running, or PLAUSIBLE).
Focus:
1. Open redirect: can any `returnTo` / `return` value (absolute URL, `//evil`, `/\evil`, encoded, `javascript:`) leave the site
   or loop (`/auth`, `/app/welcome`, `/finish-profile`)?
2. Organiser intent: the owner's failure (organiser link -> code -> photo -> ended in the dancer app). Does every path in the
   journey map end where the map says, incl. reload mid-onboarding, magic link, signed-in visitor, existing dancer? Is there
   a path where intent is silently dropped?
3. The dancer link and plain sign-in are unchanged (no organiser screen for a pure dancer).
4. `useMyDancerEdit` cache reset: can it loop or refetch storm?
5. `Auth.tsx` signed-in redirect: can it trap someone who wants to sign in as another account, or skip the code step?
6. One routing model: no second copy of the decision in screens.
Run the targeted tests you need (`npx vitest run tests/journeys src/lib/__tests__`), and a production build
(`npm run build`) if you change nothing else.

Output: `docs/review-packs/public-journeys/REVIEW.md` on a NEW branch `claude/review-764` from `4f0c8e2`, ending with
`## Verdict: ship` or `## Verdict: fix-first` (+ exact fix list). Push that branch only. Stop and report.
