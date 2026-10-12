# Session handover 2026-10-12: organiser team picker + hero Edit profile removed

Branch: `feat/organiser-team-picker` (one PR, see the PR body for the number).

## Done
- **Team picker** on the live organiser page (mockup screens 3 and 4), owner or admin only.
  The rule lives in one place: `teamPickerAccess()` in `src/modules/organiser/shared/teamModel.ts`,
  read from `organiser_team_v1`'s `my_role`.
  - Files: `edit-in-place/teamPickerModel.ts` (all rules and copy, pure), `usePeopleSearch.ts`
    (250ms debounce, stale answers ignored), `TeamSheet.tsx`, `TeamCard.tsx`, the layer's `team` slot.
  - RPCs: `organiser_team_search_people_v1` and `organiser_team_add_member_by_profile_v1` (admin #773),
    in `shared/teamRpcApi.ts`.
  - A tap picks a chip and Done adds them, one call per chip. A refused chip stays with plain-words copy.
    An admin has to give a reason. Team adds are live on Done; they don't go through the page draft or Save bar.
  - Invite fallback: there is no owner invite RPC, so it shares or copies a sign-up link (`/auth`).
- **Hero "Edit profile" button removed.** The dialog still opens from "Complete your profile" on a blank profile.
- **Bug fixed:** the public line-up query used the cache key `['organiser-team', id]`, which is the same key as
  `organiser_team_v1`. It is now `['organiser-lineup', id]`.
- Tests: `teamPicker.matrix.test.ts`, `TeamPicker.test.tsx`, the `visibility.matrix` Team rows, and the
  phone spec `organiser-team-picker.phone.spec.ts`. Screenshots are in `docs/screenshots/team-picker/`.

## Open
- No `/code-review` has run on this diff yet. There is no review stamp.
- Not checked on a real phone or keyboard. No real add has been run against prod (by design). An admin who is
  not a member gets no layer at all, so no picker (unchanged gating).
- Choices for the owner: the default role is Manager; the invite is only a sign-up link; adds go live without Save.

## Next
- The owner runs `/code-review`, then does a phone test on a real organiser they own.
