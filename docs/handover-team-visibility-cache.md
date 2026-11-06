# Handover: team-visibility-cache

- Brief premise was stale on main: `shared/publicCache.ts` does not exist and `PublicToggle.tsx` already
  invalidated the public query. The public page reads the team via react-query key `['organiser-lineup', id]`
  (`src/pages/OrganiserProfile.tsx`). No new cache root was invented.
- Change: `PublicToggle` no longer invalidates on an `unchanged` status (red first, then green).
- Tests: `team/__tests__/PublicToggle.invalidate.test.tsx` (success invalidates; `team_full` and `unchanged` do not).
- Not done: the brief's grep-driven completeness case in `publicCache.test.tsx` (file/helper absent).
