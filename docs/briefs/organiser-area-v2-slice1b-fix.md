# Brief: organiser area v2, slice 1b FIX round (continuation of PR #1511)

Brief-version: 2
Branch: claude/organiser-area-v2-chooser
Repo: Website
Lane: careful (sign-in routing). Website owns no migrations; no DB change.
Continuation of: slice 1b worker dt_efda9feba54e (PR #1511, head 4617f08). Work on the SAME branch, push to it, update PR #1511's body. Parent brief: docs/briefs/organiser-area-v2-slice1b-chooser-team.md on branch brief/organiser-area-v2-chooser.
Owner answers 2026-11-09 binding: managers do NOT refund (owner only); the role strip hides for a person with one role and nothing missing; owner hand-over hidden for everyone (not this PR).

## Goal
Close the independent review of #1511 so the PR can merge with organiserP3 flag behaviour exactly as the brief says.

## What main lacks
Continuation of an open PR: the fixes below are checked on the PR branch, not on main.
- extends: The P3 Team person screen still says "contributors" -- src/modules/organiser/team/Person.tsx
- extends: The P3 Team tab does not list Owner, Manager, Door -- src/modules/organiser/team/index.tsx
- extends: The Team roles switch uses one flag, not the flag pair -- src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx

## Fixes (do all, nothing else)
0. Update INVENTORY.md first: for the Team person screen, Team index, chooser and settings sheet list every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists, and report the coverage count (inventory items covered / total) at the end. (The two test files marked (new) exist only on the PR branch, not on main.)
1. P3 Team screens: team/Person.tsx lines 17 and 94 render ROLE_EXPLAINER = ROLE_HELP (shared/selfServeErrors.ts:356) containing "contributors". When P3 is live build the explainer from TEAM_ROLES (edit-in-place/teamRoles.ts) so no contributor word shows, and render the Owner / Manager / Door roles list on team/index.tsx (Door shown disabled with its reason, as in the picker). Test: the P3 person screen and Team index never match /contributor/i.
2. Flag pair: EditInPlaceLayer.tsx:736 p3Roles = flags.organiserP3 must use flags.organiserP3 && flags.organiserSelfServe (same as AnimatedRoutes.tsx:227). One shared helper; test organiserP3 on + organiserSelfServe off = today's picker.
3. Tests that cannot fail: in chooser.matrix.test.tsx and accountRouting.eventDay.test.ts give P5 (claim pending) openRequestCount: 1 and assert it lands on P3 Welcome via continueAsLanding(facts, true); give P4 a real role: 'manager' row; P12 must differ from a dancer-only fixture or be removed with a note. Drop the A5 "second sign-in same day" test or make it assert no storage write. X1 test: measure 44px through the class and assert Sign out too.
4. Roles read race: ContinueAsPage.tsx:201 retry: false on my_roles_v1; a failed first read hides the teacher/DJ entry for good. Allow one retry and wait while the read is fetching before landing; test: first read rejects with not_signed_in, second succeeds, organiser+teacher with one page shows the chooser, not a straight redirect.
5. X1 reachability: Account / Help / Sign out must be reachable from every P3 screen. Add one entry on P3Shell (the slice-1a role strip or its right edge, 44px) that opens the existing SettingsSheet. P3Shell is allowed for this brief.

## Files
src/modules/organiser/team/Person.tsx
src/modules/organiser/team/index.tsx
src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx
src/modules/organiser/p3/shell/P3Shell.tsx
src/components/account/profiles/ContinueAsPage.tsx
src/components/account/profiles/__tests__/chooser.matrix.test.tsx (new)
src/lib/__tests__/accountRouting.eventDay.test.ts (new)
src/modules/organiser/team/__tests__/p3Roles.test.tsx (new)

## Done when
tsc 0 errors in touched files; npm run lint exit 0; the new tests red on the PR head and green after; PR body label lines exact (Verified on real data / Phone QA); last commit ends with [worker-done dt_<ticket>]. Not allowed: DB change, Door seat creation, anything outside the five fixes.
