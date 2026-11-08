# Handover: ambassador badge, continuation 1

Brief: brief/bristol-ambassador-badge:docs/briefs/bristol-ambassador-badge-cont1.md (blob 4983bf5). PR 1474.

## Done
- Merged origin/main into the branch (it was 31 behind; no conflicts).
- `AmbassadorBadge` now calls `is_claimed_profile_ambassador_v1({ p_profile_id })`, and its prop is `profileId`. PersonHub and the tabbed PersonPage pass `person.id`.
- The badge was added to the DJ and Teacher role pages (default render, plus the DJ personHub branch). It is hidden when the page is embedded in a /people tab, so it never shows twice.
- `types.ts` was regenerated with the Supabase connector's generate_typescript_types. The only diff is the new function.
- Tests in `src/modules/ambassador/link/__tests__/AmbassadorBadge.test.tsx`:
  - component cases, including a rejected call and a synchronous throw ("badge hidden when the call fails")
  - "ambassadorBadge matrix": 4 shapes x 4 pages x signed in/out = 32 real page renders
  - the DJ and Teacher pages show the badge when the function says true
  - an embedded page shows no duplicate badge
- Mutation check: the old code fails 42 of the 46 tests. Removing the embedded guard fails 1.
- docs/design/1474.md holds the INVENTORY (moved from docs/design/bristol-ambassador-badge.md).

## Left / next steps
- personWorlds branches (DjWorld, TeacherWorldPage) have no badge yet. That needs a slot in the world components.
- The city name next to the badge: the function returns a boolean only.
- The admin app inventory was not inspected (that repo is out of this session's scope).
