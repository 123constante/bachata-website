# Handover: P3 W4a fix 3 (branch `claude/p3-w4a-fix3`)

Brief: `brief/p3-fix3:docs/briefs/p3-w4a-fix3.md`. Source: review `claude/review-1080-r1:docs/review/pr-1080-r1.md`.
Ticket dt_18f3c0be200f. Flags `organiserP3` and `organiserSelfServe` are unchanged (P3 still OFF in prod).

## Done

- **One mapping**: `src/modules/organiser/shared/teamRules.ts` decides what Team, Person, Hand over and the
  join-request card offer (`canAdd`, `canDecline`, `canManagePeople`, `canRemove`, `canLeave`, `canHandOver`),
  plus the one `NO_PAGE` copy. `team/GateReason.tsx` renders a refusal's reason with the Message us link
  (`ORG_PATHS.help`). The rules are what the live RPC bodies accept (prod, read 2026-10-28, SELECT only):
  - F1 Decline: `resolve_organiser_access_request_v1` is owner (or admin) only -> Decline disabled with a reason for a manager.
  - F2 Ownerless page (39 of 51 prod pages, each one manager): Decline, role change/remove and Hand over say
    "This page has no owner yet, so only the Bachata Calendar team can ..." + Message us; never "ask the owner".
  - F3 Leave: disabled with a reason when no OTHER owner/manager would remain (covers `members.length === 1`
    and no owner). **The server guard belongs to the admin repo** (`remove_organiser_member_v1` guards
    `last_owner` only) and is not touched here.
  - F4 Contributor: Remove is disabled (RPC resolves targets with `member_role IN ('owner','manager')` ->
    `not_a_member`); a contributor's own Leave is disabled (`not_authorised`). Both with Message us.
- F5: `acceptedInviteLanding(id, flags)` in `p3/shell/paths.ts` (P3 Welcome when both flags on, else R1's).
  NOTE: no caller exists in this repo for EITHER welcome URL (grep finds none), so nothing is wired yet;
  whoever builds the accept landing calls this one function. R1 untouched.
- F6: You, P3 Team and the P3 page editor at 0 pages show `NO_PAGE` (invite-only copy) + Message us; You's
  disabled Team row says why without "Add one first". R1 Team/page-editor copy unchanged (R1 Home has the add).
- F7: Done navigation moved into `mutate()` callbacks (Person Remove/Make Manager, Hand over Confirm, AddSomeone);
  cache invalidation stays on the mutation. TanStack drops `mutate()` callbacks after unmount.
- F8: `TEAM_COPY.already_member`, `TEAM_COPY.lookup_cap`; `teamErrorMessage` reads the prefixed
  `permission_denied: lookup_cap: ...`; AddSomeone's search/wall errors show it.
- F9 `team-full` -> `team-add-reason`; F10 P3 Welcome fallback line; F11 the pushed-screen Suspense fallback
  renders `P3PushedShell` (top bar, back to You).
- Shared R1/P3 screens: F1/F3/F4/F7/F8 apply to R1 as well (same components; the RPC refuses there too).

## Tests

RED first: the 12 new rows in `p3/you/__tests__/you.matrix.test.tsx` ("W4a fix 3") were run on the unfixed
code: 11 failed at once; F7 failed once the settle wait covered the onSuccess chain (400 ms). Three older rows
encoded mock-only behaviour and were updated (contributor remove -> manager; page no-page copy; testid rename);
`TeamFixPass` gained an owner in its "manager viewing another member" fixture (that row is the owned shape).

## Left / next

- Admin repo: server guard for the last member leaving an ownerless page; optionally let managers decline.
- Wire `acceptedInviteLanding` where the accept flow lands (none exists today).
- F12 note: P3 Done's primary reads "Go back" (acceptable; handover wording was optimistic).
- Not done: browser walk at 390x844 (no walk account in this sandbox); no new overlays were added, so the
  overlay-geometry e2e has nothing new to assert.
