# Handover: organiser Team tab, core (admin #1535) [dt_7deb22969a63]

Branch `claude/profile-dash-organiser-team-build`. Website only, no migration, no new RPC, no prod write. Behind `flags.organiserDash` and the P3 surface; flag off = the old Team tab, unchanged.

## Done
- `src/modules/organiser/p3/dash/team/`: `teamDashModel.ts` (pure: groups Owners / Managers / Contributors, one role line each, fold after 5, solo, view-only, loading, error, person sheet rules, removal copy), `TeamDashView.tsx` (rows, person sheet, remove confirmation, add sheet), `TeamDashRoute.tsx` (wires the existing RPCs: `organiser_team_v1`, `organiser_team_shared_v1`, `organiser_team_set_member_v1`, `set_organiser_team_member_hidden_v1`, `remove_organiser_member_v1`; keeps the existing "Wants to join" cards).
- `team/index.tsx`: flag switch only; the old page is `TeamPageClassic`.
- `focusReturn.test.tsx`: the new SheetView file added to the known call sites (it passes `returnFocusRef`).
- Tests: `__tests__/teamDash.matrix.test.tsx`, 29 table-driven cases over solo, two, huge, stub, hidden contributor, contributor viewer, full team, loading, error.

## Needs admin work (drawn disabled with the reason, or left out)
- Invite by email: Add sheet shows a disabled "Invite by email" with its reason.
- Waiting-to-join group: not drawn (no read for it exists).
- Choosing a role while adding: the existing Find route adds managers only; the sheet says so. The empty Contributors group has no Add for the same reason.
- Make someone an owner from the role radios: disabled, "hand the page over" (uses the existing handover).
- Contributor wording and what a contributor may read: the contributor line is draft until the ACL decision.
- "Owners and managers always show": not enforced server-side; the sheet still offers un-hiding when a row is actually hidden.

## Verified on real data
- Shapes surveyed: the 2026-11-12 prod counts in docs/design/profile-dash/organiser-team.md (seats owner 21 / manager 43 / contributor 0; team sizes 1-4; 16 pages with one owner). No new prod read in this run.
- Checks run: new matrix test + focusReturn + team tests green; `npm run lint` 34/34 links green; `check:mojibake` clean; eslint 0 errors on touched files; tsc 0 errors in touched files. `npx vitest run src/modules/organiser`: only the focusReturn failure, since fixed.
- NOT verified: full `npm run pre-ship` (exceeds the sandbox time limit; its unit stage showed 5 failures in tests/integrityCouldNotRun.test.ts, "typescript resolved in the temp repo", which touch no file here); CI per-job table; `/code-review`; tests were written after the code, not red-first.

## Phone QA
- Sizes checked: none.
- Walked: nothing in a browser. Tap targets are set to min 44px in code only.
- Not verified: the 390x844 walk with screenshots, a real phone, the live RPCs with a real team.

## Next
Run the 390x844 walk with the flag on, `npm run pre-ship` in CI, `/code-review`, then open the PR (body above, then both check-pr scripts).

## Fix round 1 (dt_533412569899)
Fixed on the same branch:
1. Interim manager: Add is "Share a join link" and calls the share directly (`addVia: 'share'`); no Add sheet, no Find link, no empty-Managers Add link. Own row shows "Interim manager".
2. No page: new `nopage` load state shows the old NO_PAGE empty state with Message us (paths.help).
3. teamRules: person sheet roles/remove/leave now come from `canManagePeople` / `canRemove` / `canLeave`; ownerless pages say NO_OWNER_REASON plus Message us; "Owners cannot remove another owner" only for an owner viewer; contributor view-only note on an ownerless page names no owner.
4. Carried over: PublicToggle (own row, "Public team" card), RequestsError, PageNameCaption (2+ pages), ownRowLabel.
5. Tests: SHAPES gained manager viewer, interim, no owner, no owner + contributor viewer, no page; disabled-reason sweep also runs with each person sheet open; the public switch has aria-describedby to its reason (id on the `<p>`).
6. Middle dot is now a `·` escape; check:mojibake clean.
7. Pre-existing calls listed in the PR body. PR body updated (both check-pr scripts exit 0).

Verified: teamDash matrix 54/54; tsc 0 errors in touched files (unrelated errors in app/); eslint clean on the team folder.
Not verified: `npm run pre-ship`, per-job CI, /code-review, the 390x844 walk with screenshots (no preview host here), live RPCs. Tests were not run red-first.
