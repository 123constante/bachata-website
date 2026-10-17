# REVIEW-S6 -- independent review of slice S6 (Team, faces wall, join request, one person, hand over)

Reviewer branch `claude/org-r1-review-S6`, cut from `claude/org-r1-team` @ `18cccba`. Base for the diff: `claude/org-r1-integrate` @ `fe2de2b`. Method and defect classes from `briefs/R-S5.md`; slice brief `briefs/S6-team.md`; author handover `handovers/S6.md`. ONE pass, no fixes, no source changed. Only this file is committed.

**Stopping rule (stated before the pass):** one review round; findings go back to the S6 slice in one fix pass. A finding proved by mutation (a mutant the suite does not catch) is reported, not fixed here.

## Verdict: 2 BLOCKING / 4 SHOULD / 6 NOTE

| # | Sev | Where | Finding |
|---|---|---|---|
| B1 | BLOCKING | `team/Avatar.tsx:10` | `check:images` (AUDIT_STRICT=1, `integrity` job) is RED on the S6 head and green on the base |
| B2 | BLOCKING | `flows/fix/JoinRequest.tsx:35`, `team/AddSomeone.tsx:34,50`, `team/index.tsx:115` | Prod's add call is OWNER-ONLY; a manager is offered Add as Manager / faces / search results that prod always refuses |
| S1 | SHOULD | `flows/fix/JoinRequest.tsx:37` | The best-effort `resolve(grant)` after the add ALWAYS throws on prod (dead second command), and no test sees it (mutant M1 survives) |
| S2 | SHOULD | `flows/fix/JoinRequest.tsx:35` | Requester `user_id` as `p_profile_id`: 4 of 22 prod accounts do not resolve that way; they get `user_not_found` with copy that is wrong for them |
| S3 | SHOULD | `team/AddSomeone.tsx:35,78,108` | "Never the organiser's own members" compares member `user_id` with face `profile_id`; the test uses the same string for both so it cannot catch a difference |
| S4 | SHOULD | `team/Person.tsx:14` | Role explainer says "Owners add and remove people", contradicting D50 (managers add) shown one screen back |
| N1 | NOTE | `shared/teamModel.ts:224` | C30 "confirmed email" = "an email was sent"; prod sends `u.email` unconfirmed or not, and transfer accepts any confirmed identifier |
| N2 | NOTE | `team/browseApi.ts:234` | "1 dancers have an account and a photo"; and the line says "and a photo" over faces that show initials |
| N3 | NOTE | `team/Person.tsx:75-95` | A manager viewing another member: Remove is absent (no disabled control, no reason); only the role reason shows |
| N4 | NOTE | `team/AddSomeone.tsx:96,98` | Two dead-end states with no action: "Choose a page first." (no switcher on this screen) and "Only an owner or a manager adds people." |
| N5 | NOTE | `team/useTeamContext.ts:140-143` | When the team read fails, any non-owner (a contributor too) falls back to `manager`, so Add someone shows |
| N6 | NOTE | `handovers/S6.md` CI table | Handover reports `check:images` pass; it fails (B1). Process: the table was not re-run on the final head |

---

## Findings

### B1 -- `check:images` red (Avatar `<img>` without `loading`)
`team/Avatar.tsx:10` renders `<img src alt="" ... />` with no `loading` attribute. `AUDIT_STRICT=1 npm run check:images`:
```
Total <img> tags: 92   missing alt: 0   missing loading: 1   missing both: 0
  src/modules/organiser/team/Avatar.tsx:10  missing: loading
exit 1
```
Same command on base `fe2de2b` (worktree): exit 0. This is a step of the `integrity` CI job (CLAUDE.md DoD #3), so the PR cannot be green.
**Fix:** add `loading="lazy"` to the Avatar `<img>` (faces wall pages to 90+ images; lazy is right).

### B2 -- the add call is owner-only on prod; managers are offered it
Prod `pg_proc` (read-only): `organiser_team_add_member_by_profile_v1` starts with `_organiser_team_write_gate_p5`, whose body is:
```
ELSIF v_caller IN ('manager', 'contributor') THEN RAISE EXCEPTION 'owner_only';
```
The slice offers the add to managers on three surfaces (D50): the request card's "Add as Manager" (`JoinRequest.tsx:63`, enabled for any viewer), "Add someone" (`index.tsx:115`) leading to a wall whose faces and search results call the add (`AddSomeone.tsx:34,50`). On prod today a manager who taps any of them gets `owner_only` -> TEAM_COPY "Only an owner can do that. As a manager or contributor you can see the team and leave it." -- a control that cannot work, not disabled, and an error that contradicts the screen. (The request card is live data today: 2 open requests on prod.) The browse RPC is also not on prod (author's decision 2), so the faces half is knowingly A1-dependent; the request card and search are not.
**Fix:** either (a) record in the handover and PR body that R1 cannot ship before A1 opens `_organiser_team_write_gate_p5` (or the add) to managers, and add a test that the `owner_only` refusal reads sensibly, or (b) until A1 lands, disable the add surfaces for a manager WITH the reason ("Only the owner adds people for now"). Orchestrator call; the slice cannot pick silently.

### S1 -- the resolve after the add is a dead second command, untested
Prod `_organiser_access_requests_p5` derives a request's status: no grant/decline audit AND the requester is in `entity_members` -> `'member'`; `list_organiser_access_requests_v1('incoming')` lists only `status = 'open'`. So the add alone closes the card. The follow-up `resolveAccessRequest(id, 'grant')` then always throws: for an owner `request_not_open` (status is now `'member'`), for a manager `not_authorised` (resolve is owner/admin only). It is swallowed (`catch {}`), so every Add as Manager sends TWO commands, the second of which can never succeed. The single-step rule (one command per action) is broken and the tests do not notice: the card test counts only `organiser_team_add_member_by_profile_v1` calls.
Mutation M1 (delete the resolve line): **19/19 still pass**. Mutation M2 (send a second add) is caught.
**Fix:** delete the resolve call and assert the whole write set: `world.sent` filtered to writes equals exactly the one add.

### S2 -- requester `user_id` as `p_profile_id`
The add resolves the person through `_organiser_team_people_p5(p_profile_id)`: `dancer_profiles` row with that id, active, unarchived, `_person_lineup_visible_v1`, a public name, and an account that `_dancer_profile_id_for_account_v1` maps back to THIS row. Survey (counts only):

| shape | count |
|---|---|
| prod accounts | 22 |
| accounts whose own id does NOT resolve via `_organiser_team_people_p5(user_id)` | **4** |
| of which the account maps to a different (claimed) profile | 2 |
| open access requests | 2 |
| open requests whose requester does not resolve | 0 |

So it works for today's two requests, but ~1 account in 5 would get `user_not_found`, which reads "No account has that email address. Ask them to sign up to Bachata Calendar first, then add them." -- false for a person who just asked from their account. `resolve_organiser_access_request_v1(grant)` adds by `user_id` with no visibility gate and would add all 4.
**Fix (orchestrator call):** either ask A1 for `profile_id` on the incoming-requests read (author's own suggestion), or make the card's ONE write the existing `resolve(grant, 'manager')` (keyed by user_id, closes the request in the same call). At minimum map `user_not_found` on the card to copy that fits ("We could not add them from here. Ask the Bachata Calendar team.").

### S3 -- wall member exclusion compares different id kinds
`memberIds` is built from `members.map(m => m.userId)` (`AddSomeone.tsx:35`) and faces are filtered by `f.profileId` (`:78`; search `:108`). These are equal only when the member's dancer profile id is their user id. Prod has 2 accounts mapped to a claimed profile whose id differs (0 of them are on a team today), so such a member would appear on their own team's wall with "Add". The test row (`Team.test.tsx` "never the organiser's own members") uses member `'ana'` and face `profile_id: 'ana'`, so it passes whichever id is compared. (Mutation M6, removing the filter, is caught -- the filter is tested, the id kind is not.)
**Fix:** pin in 4.3 #10 that browse/search exclude current members server-side (cheapest), or carry `profile_id` on `organiser_team_v1` rows and compare like with like; add a test row where the two ids differ.

### S4 -- explainer contradicts D50
`Person.tsx:14` `ROLE_EXPLAINER = 'Owners add and remove people, change roles and hand the page over. Managers edit every event and send it for review.'` A manager reads this one tap after seeing their own "Add someone" button. Same fact, two answers.
**Fix:** "Owners and managers add people. Only the owner removes people, changes roles and hands the page over. Managers edit every event and send it for review."

### N1 -- C30 "confirmed email" approximation
Prod `organiser_team_v1` returns `'email', CASE WHEN v_caller IN ('owner','admin') THEN u.email END` with no confirmation check; `organiser_transfer_ownership_v1` accepts any confirmed identifier (`email_confirmed_at`, `phone_confirmed_at`, SSO, OAuth identity) via `_member_target_account_p5`. So C30 can list an unconfirmed member (refused, generic copy) and would hide an email-less phone/OAuth member the server accepts. Survey: 4 organiser members, all owners, 0 with null or unconfirmed email; 4 of 22 accounts are unconfirmed, but every add path (`add_member_by_profile`, `resolve grant`) refuses unconfirmed accounts, so a manager reaching C30 is in practice confirmed. Low risk. One wrinkle: the `unconfirmed_email` refusal on C31 reads "... Ask them to confirm it, then add them." -- "add them" is wrong in a hand-over. **Fix:** ask A1 for `email_confirmed` on owner-visible rows (later), and give C31 its own refusal line.

### N2 -- wall line copy
`shortWallLine(1)` -> "1 dancers have an account and a photo so far." The walk shows the line under two faces that display initials (attendee tier has no photo requirement), so "and a photo" reads wrong there. **Fix:** singular form, and "have an account" when the count includes photo-less faces.

### N3 -- manager viewing a member: Remove absent
Brief (d) asks for disabled-with-reason on the role change; that is done (`person-change-role` disabled, "Only the owner changes roles"; mutants M8, M9 caught). Remove simply does not render for a manager, with nothing saying why. Acceptable under the brief's letter; one shared line ("Only the owner changes roles or removes people") would cover both.

### N4 -- dead-end states on `/team/add`
`AddSomeone.tsx:96` "Choose a page first." -- the switcher is on `/team`, not here, so the copy points at a control not on screen; `:98` "Only an owner or a manager adds people." has no way back other than the header. Add a link to Team in both.

### N5 -- role fallback
`useTeamContext.ts:140-143`: if `organiser_team_v1` fails and the Home read's role is not `owner`, the viewer is treated as `manager` (a contributor too), so Add someone shows. Contributors are legacy and rare; map `contributor` explicitly.

### N6 -- handover CI table
See B1: the table says `check:images (AUDIT_STRICT=1) | pass`. It fails on `18cccba`. Re-run the table on the final head before hand-off.

---

## Probes asked of this review

| Probe | Result |
|---|---|
| (a) request card sends `user_id` as `profile_id`, swallows resolve errors | Add closes the request by itself (derived status `member`); resolve always throws (S1). Owner: works for both open prod requests; 4/22 accounts would fail with wrong copy (S2). Manager: the add itself is refused `owner_only` on prod (B2) |
| (b) C30 confirmed email approximated by "email sent" | Not equivalent on prod, low practical risk today (N1) |
| (c) remove/transfer take `user_id`, browse/add take `profile_id` | Prod args confirmed: `remove_organiser_member_v1(p_organiser_id, p_user_id)`, `organiser_transfer_ownership_v1(p_organiser_id, p_to_user_id, p_reason)`, `organiser_team_add_member_by_profile_v1(p_organiser_id, p_profile_id, ...)`. URLs carry user_id; the profile!=user test row passes (and M12 sending another id is caught). Gap: wall exclusion (S3) |
| (d) manager cannot change roles / remove; disabled with reason | Role: yes, reason "Only the owner changes roles" (M8, M9 red). Remove: absent, no reason (N3) |
| (e) team cap 20 disabled with reason | Yes: Add someone, request-card add, wall faces, search results, invite row; "This team is full (20)" (M4, M11, M13 red) |
| (f) faces >= 44px in px | `min-h-[44px]`, Avatar 56px inline style, card buttons `size="sm"` = 44px (Buttons.tsx:10). M5 (`min-h-[2.75rem]`) red |
| (g) `handOverWarning` single importer | `grep`: only `flows/handover/Confirm.tsx:5` imports it (plus its definition `shared/copy.ts:15`); test asserts it |
| (h) invite text verbatim, never name-matches | `browseApi.ts:231` equals the D56 text exactly; Invite writes nothing (test asserts no write; M3, M7 red). Search adds by the chosen `profile_id`, never by name |
| (i) every empty state says what to do | Team no-organiser, handover empty (Add someone), search no results, person missing: yes. Two exceptions (N4) |
| (j) mutate the new tests | 16 mutants below: 15 caught, 1 survived (M1 -> S1) |

## Mutation evidence
Each: one `sed` on the source, run the owning spec, `git checkout` the file. Spec T = `team/__tests__/Team.test.tsx` (19 tests), H = `flows/handover/__tests__/handover.test.tsx` (7).

| # | Mutant | Result |
|---|---|---|
| M1 | delete the post-add `resolveAccessRequest` | **SURVIVED** -- T 19/19 pass |
| M2 | request card sends a second add | red: "Add as Manager sends ONE add call" |
| M3 | Invite face adds instead of sharing | red: 2 (Invite share; copy fallback) |
| M4 | cap ignored on tap and on `disabled` | red: "team at 20 -> the wall is disabled" |
| M5 | face `min-h-[44px]` -> `min-h-[2.75rem]` | red: "44px+ faces" |
| M6 | member filter removed from the wall | red: "never the organiser's own members" |
| M7 | invite text altered | red: Invite share text |
| M8 | manager's Change role enabled | red: manager viewing another member |
| M9 | role reason line removed | red: same |
| M10 | `canReceiveOwnership` = not self | red: 2 in H |
| M11 | `TEAM_CAP` 21 | red: 2 in T |
| M12 | remove sends the email instead of user_id | red: remove sends user_id |
| M13 | request card never blocked when full | red: at 20 members |
| M14 | short/empty wall line removed | red: 0 faces empty state |
| M15 | Hand over sends two transfers | red: ONE transfer call |
| M16 | copy fallback does not announce | red: "Link copied" |

## CI (run in the sandbox on `18cccba`)

| Step | Result |
|---|---|
| `vitest run` team, flows/handover, flows Done, teamModel, shell (10 files) | 114/114 pass |
| `tsc -p tsconfig.app.json --noEmit` | 110 errors; base `fe2de2b` 110 -> no new errors (none in S6 files). The R-S5 template's "96" is stale for this base |
| `npm run lint` chain | 17/18 links pass; `check:integrity` exit 126 (script not executable in this checkout; same as author) -> eslint link skipped by design |
| `check:mojibake` | pass |
| `lint:architecture` | pass |
| `check:images` AUDIT_STRICT=1 | **FAIL** (B1); base pass |
| `build` | pass |
| `playwright tests/e2e/organiser-team.spec.ts` | 1st (cold dev server) 3/5, the two request-card tests failed; rerun of test 1 alone pass; full rerun 5/5 pass. Treat as cold-start, not code |
| `test:unit` full suite, `e2e-smoke` full list, `check:integrity` | not run (time / environment) |
| PR checks | no PR for `claude/org-r1-team` seen by this worker; not read |

## Walk (390x844, Playwright on `helpers/organiserFake.ts` mocked data)
Team (two request cards above the list, 3 members, Add someone), Add someone (2 faces, short line, invite row), one person as owner (explainer, Hand the page over, Remove), Hand over to whom. Nothing cramped or truncated; faces and buttons read at size. Copy issues seen on screen: S4 (explainer), N2 ("a photo" under initials). Screenshots stayed in the reviewer's scratchpad (not committed; review commits one file only).

## Verified
- Prod `pg_proc` (SELECT only) for organiser_team_v1, add_member_by_profile, remove, transfer, resolve, list requests, `_organiser_access_requests_p5`, `_organiser_team_people_p5`, `_member_target_account_p5`, `_organiser_team_write_gate_p5`; `organiser_team_browse_people_v1` is absent on prod.
- Shape counts above (accounts 22; 4 unresolvable by user id; 2 mapped to another profile; 2 open requests; 4 organiser members, all owners, 0 unconfirmed).
- 16 mutations; CI steps in the table; e2e spec; walk on mocked data.

## Not verified
- Anything against the A1 shapes (browse RPC, `display_name`/`photo_url`/`added_by_display_name` on `organiser_team_v1`): not on prod; fixture-only.
- A manager session against prod (B2 is read from the gate body, not exercised).
- Full `test:unit`, full e2e smoke list, `check:integrity` script, PR checks on GitHub, a real phone.

[review-ticket dt_7e9dc0f75123]
