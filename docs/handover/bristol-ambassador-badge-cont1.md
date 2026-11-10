# Handover: ambassador badge, continuation 1

Brief: brief/bristol-ambassador-badge:docs/briefs/bristol-ambassador-badge-cont1.md (blob 4983bf5). PR 1474.

## Done
- Merged origin/main into the branch (it was 31 behind; no conflicts).
- `AmbassadorBadge` now calls `is_claimed_profile_ambassador_v1({ p_profile_id })`, and its prop is `profileId`. PersonHub and the tabbed PersonPage pass `person.id`.
- The badge was added to the DJ and Teacher role pages (default render). It is hidden when the page is embedded in a /people tab, so it never shows twice. It has `aria-controls` linking it to its note.
- `types.ts` was regenerated with the Supabase connector's generate_typescript_types. The only diff is the new function.
- Tests in `src/modules/ambassador/link/__tests__/AmbassadorBadge.test.tsx`:
  - component cases, including a rejected call and a synchronous throw ("badge hidden when the call fails")
  - "ambassadorBadge matrix": 4 shapes x 4 pages x signed in/out = 32 real page renders
  - the DJ and Teacher pages show the badge when the function says true
  - an embedded page shows no duplicate badge
- Mutation check: the old code fails 42 of the 46 tests. Removing the embedded guard fails 1.
- docs/design/1474.md holds the INVENTORY (moved from docs/design/bristol-ambassador-badge.md).

## Left / next steps
- personWorlds branches (DjWorld, TeacherWorldPage) and the DJ personHub branch (DjRolePage) have no badge yet. Each needs a slot in its component. /code-review found a badge placed above DjRolePage sat above the Back row, so it was removed.
- Badge caching via React Query (review): every existing PersonPage test renders without a QueryClientProvider, so moving to useQuery needs those tests wrapped first.
- Layout shift when the badge appears after load (review): accepted for now; there are 0 ambassadors on prod.
- The city name next to the badge: the function returns a boolean only.
- The admin app inventory was not inspected (that repo is out of this session's scope).

## Verification
- Walk at 390x844, Playwright, `activeCitySlug=bristol-gb`, local dev server on prod data. Real claimed 3-role profile `b`: /people/b, /djs/b, /teachers/b (VITE_ENABLE_TEACHER_DETAIL=true).
  - Function mocked `true`: badge shows once, 44px tap target, the note opens, no horizontal overflow.
  - Real prod answer (`false`): no badge.
- Trap: this session's environment sets VITE_SUPABASE_URL to a NON-prod project, and it overrides .env.local. Set the prod URL and key in the process env before `react-router dev`; the dev server also needs NODE_USE_ENV_PROXY=1 and NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt.
- typecheck (`npm run typecheck`): 125 errors, the identical set to main, so 0 new errors in branch files.
- `npm run lint`: 34 of 34 links green.
- `npm run test:unit`: 16 failures in 5 files. All are environment-related, none touch these files:
  - 3 live contract files hit the non-prod project.
  - `integrityCouldNotRun` fails identically on main.
  - the door shortCode matrix passes on its own.

## Not verified
- A real ambassador; prod has 0.
- A real phone.
- personWorlds / DJ personHub flag branches.
- The admin app.
