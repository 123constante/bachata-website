# REVIEW-INT-A: whole-diff review of PR #809 (correctness and data)

Reviewed: `claude/org-r1-integrate` @ `8dffd70c` against `origin/main` (256 files; focus `src/modules/organiser/**`).
This was one review pass, and no source files were changed. Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/R-INT-A.md`.

**Verdict: 2 BLOCKING / 9 SHOULD / 11 NOTE**

---

## BLOCKING

### B1. build-smoke is red: 3 public-journey rows wait for `home-dates`, which R1 Home no longer renders
- **Where:** `tests/e2e-build/public-journeys.build.spec.ts:40,42,43` (M14, M35, M53). R1 `home/index.tsx` has no `home-dates`. Main had it at `home/index.tsx:196`.
- **Why:** PR #809's `build-smoke` job fails with 4 failed and 62 passed. Three of those failures are this seam: the run lands on `/account/o` correctly, then times out waiting for a testid that was deleted. INTEGRATE2/S8 do not record this red.
- **Fix:** point the three END rows at an R1 Home testid. `home-new-event` and `home-job` are both always present for an organiser with a page.
- **Evidence:**
  ```
  $ git grep -n "home-dates" HEAD -- src tests
  HEAD:tests/e2e-build/public-journeys.build.spec.ts:40:  'organiser-link-organiser-signed-in': { testId: 'home-dates', ...
  HEAD:tests/e2e-build/public-journeys.build.spec.ts:42:  'signin-unfinished-dancer-with-organiser': { testId: 'home-dates', ...
  HEAD:tests/e2e-build/public-journeys.build.spec.ts:43:  'team-invite-existing-dancer': { testId: 'home-dates', ...
  $ git grep -n "home-dates" origin/main -- src
  origin/main:src/modules/organiser/home/index.tsx:196:                <Card testId="home-dates">
  CI job 117426898377: Locator: getByTestId('home-dates') ... Error: element(s) not found ... 4 failed / 62 passed
  ```
  I reproduced it locally with `npx playwright test --config playwright.build.config.ts tests/e2e-build/public-journeys.build.spec.ts`:
  `organiser-link-organiser-signed-in ... Error: END screen; hops: ... -> /account/o`.
- The 4th red, `auth-consent.build.spec.ts:63` ("sign-up code box: consent line"), was **not traced**. See Not verified.

### B2. A person with no access to an event sees "check your connection" plus a Try again button that can never work
- **Where:** `events/OneEvent.tsx:158-159`, `events/Details.tsx:159`, `flows/fix/CoverFlow.tsx:70-71`, `flows/cancel/Confirm.tsx:55`.
- **Why:** `admin_event_workspace_p5` refuses non-members through `_assert_can_edit_series_p5`. On main, `EventEditorPage.tsx:363` branched on `isAccessRefusal` and showed "You do not have access to this event". R1 dropped that branch, so every refusal now gets the generic `ErrorState`. This reaches real people: a removed team member, or anyone opening a forwarded event link. The copy points at a control that cannot work, which breaks DoD rule 2.
- **Fix:** branch on `isAccessRefusal(ws.error)` on these screens, show the no-access copy, and show no retry button. Add a matrix row for it.
- **Evidence:**
  ```
  $ git grep -n "isAccessRefusal" HEAD -- src
  HEAD:src/modules/organiser/shared/selfServeErrors.ts:210:export const isAccessRefusal = (error: unknown) =>    <- definition only, 0 callers
  $ git grep -n "isAccessRefusal" origin/main -- src
  origin/main:src/modules/organiser/events/EventEditorPage.tsx:363:        workspace.isError && isAccessRefusal(workspace.error) ? (
  $ sed -n 158,159p src/modules/organiser/events/OneEvent.tsx
    const body = home.isError || ws.isError ? (
      <ErrorState onRetry={...} testId="org-event-error" />
  ```

---

## SHOULD

### S1. "Put back" on One event makes a new idempotency key on every tap and shows a conflict as inline text
- **Where:** `events/DatesTakenOff.tsx:31` calls `shared/runCommands.ts:46`, which calls `envelope(seriesId, v, command)` with no key. This is rendered on the R1 screen at `events/OneEvent.tsx:175`.
- **Why:**
  - A retry after a lost reply cannot be replayed by its key. It hits `version_conflict` instead.
  - That conflict is caught and shown as `commandErrorMessage` text at `:34`, not on the shared conflict view.
  - It is also missing from the matrix CONFLICTS rows.
- **Fix:** send through `useEventSend`/`useFlowSend`, which hold the key in a ref and route a conflict to `EventConflict`, and add a CONFLICTS row.
- **Evidence:**
  ```
  $ grep -n "runSeriesCommand(envelope" shared/runCommands.ts
  46:        const res = await runSeriesCommand(envelope(seriesId, v, command));
  $ grep -n "run(\[row.command\]\|commandErrorMessage" events/DatesTakenOff.tsx
  31:      await run([row.command], series.version);
  34:      setError({ date: row.date, message: commandErrorMessage(err) });
  ```

### S2. The conflict view exists three times, not once
- **Where:** `flows/event/parts.tsx:19` `EventConflict`, `flows/add/parts.tsx:72` `Conflict`, `flows/change/parts.tsx:83` `Conflict`.
- **Why:** all three have the same copy and button, with different testids. The rule is one shared mapping, never two copies.
- **Fix:** have the add and change flows render `EventConflict`, passing a testId if needed, and delete the two copies.
- **Evidence:** `grep -rn "export function .*Conflict" flows` returns exactly the three lines above.

### S3. A third copy of the status words, not pinned to the other two
- **Where:** `jobs/homeJobs.ts:61` `LIFECYCLE_CHIP`. The first two copies are `shared/eventState.ts:26` `LIFECYCLE_WORD` and `shared/selfServeApi.ts:448` `LIFECYCLE_LABEL`, which a test pins equal.
- **Why:** `LIFECYCLE_CHIP` has no entries for `pending_review` or `rejected`. `seriesChip` (`:69`) falls back to the raw enum, so My events would show `pending_review` while the date page says "In review".
- **Status:** latent. Prod has 0 such series today: archived 652, live 67, ended 20, draft 6, paused 1.
- **Fix:** delete `LIFECYCLE_CHIP` and use `LIFECYCLE_WORD`.
- **Evidence:**
  ```
  $ sed -n 61p jobs/homeJobs.ts
  const LIFECYCLE_CHIP: Record<string, string> = { live: 'Live', paused: 'Paused', ended: 'Ended', archived: 'Archived' };
  ```

### S4. The `owner_only` refusal from the add-member RPC is worded two ways
- **Where:** `team/teamErrors.ts:4`, used by `AddSomeone.tsx:58`: "Only the owner can add people to this page for now…". `edit-in-place/teamPickerModel.ts:157-158` (`:195`): "Only an owner of this page can add people. Nothing was changed."
- **Fix:** keep one string in `shared/selfServeErrors.ts` and use it in both places.
- **Evidence:** `grep -rn "addErrorMessage\|addRefusalCopy" src` returns the two separate mappers.

### S5. The role explainer is in two places, and both promise a review step that no longer exists
- **Where:** `team/Person.tsx:14` and `edit-in-place/teamPickerModel.ts:84`, both saying "Managers edit every event and send it for review".
- **Why:**
  - D4/S0b removed review. `shared/seriesCommands.ts:238` says "There is no review step".
  - So the copy describes something that is not on screen.
  - This is separate from the known "Make owner" line.
- **Fix:** keep one role-help string, without the review clause.
- **Evidence:**
  ```
  $ grep -rn "for review" --include=*.ts* src/modules/organiser | grep -v __tests__
  ./team/Person.tsx:14:export const ROLE_EXPLAINER = '... Managers edit every event and send it for review.';
  ./edit-in-place/teamPickerModel.ts:84:  roleHelp: 'Managers edit every event and send it for review. ...',
  ```

### S6. `routes.test.tsx` does not mount 12 of the routes in `OrganiserRoutes.tsx`
- **Missing:** `new/name`, `new/:seriesId/{venue,date,time,cover}`, `team/add`, `team/:userId`, `handover`, `handover/:userId`, `more`, `more/help`, `cover/:seriesId`.
- **Also:** `/account/o/done` is listed twice.
- **Fix:** add each missing path, with its screen testid, to the main-screen `it.each`, and drop the duplicate.
- **Evidence:** `grep -rn "team/add\|handover\|more/help\|cover/\|new/name" shell/__tests__/routes.test.tsx` returns nothing. These paths appear only in `paths.test.ts`.

### S7. /team/add's browse wall always fails on prod today
- **Where:** `team/browseApi.ts:49` calls `organiser_team_browse_people_v1`, which does not exist on prod.
- **Why:** an owner opening Add someone gets "The dancers did not load". The S6 handover lists this under admin A1. The known-context list names only A1b (manager-add).
- **Fix:** list A1 (browse) next to A1b as a ship blocker, or hide the browse wall until the RPC exists.
- **Evidence** (prod, read-only):
  ```
  select proname from pg_proc where proname in ('organiser_team_browse_people_v1','organiser_team_search_people_v1','organiser_team_add_member_by_profile_v1')
  -> organiser_team_add_member_by_profile_v1, organiser_team_search_people_v1      (browse missing)
  ```

### S8. My page saves can overwrite a co-manager's newer edits (needs admin; queue it)
- **Where:** `lib/organiserProfileUpdate.ts:99` calls `organiser_profile_update_p5_v1`. Its args are only `{ p_organiser_id, p_patch }` (types.ts:11983). `draftModel.ts:4-10` re-sends the whole stored form.
- **Why:** a manager saving from a stale tab silently reverts a co-manager's newer socials. Four prod pages have 2-5 team members.
- **Fix:** an admin migration adds `p_expected_version`. The website then sends it and shows `EventConflict`-style copy.

### S9. Mutation survived: the "one past-date sentence everywhere" test cannot catch a reworded copy
- **Where:** `__tests__/consistency.matrix.test.tsx`, "the past-date refusal is one sentence everywhere".
- **Why:** the test collects variants with `/already happened, so it can no longer be changed/`. A rewording that breaks that phrase drops its own row from `it.each`, so the test passes with one row fewer.
- **Fix:** pin the expected file list or count, or match a looser stem such as `/so it can no longer be changed/`.
- **Evidence:** see Mutation proof row 1. The result was GREEN at 14 of 15 rows.

---

## NOTE

1. **Three different conflict detectors.** `flows/new/useNewSend.ts:8` and `flows/fix/CoverFlow.tsx:57` use an unanchored `/version_conflict/i`, while the shared `isVersionConflict` (`selfServeErrors.ts:214`) is anchored. Fix: import the shared one.
2. **The date page (main's editor, `dates/useDateEditor.ts:103,116,137`) is still reachable and does not follow the write rules.**
   - It sends no idempotency key, so every attempt gets a new one.
   - `version ?? null` sends no `expected_version` while the detail or workspace read is pending.
   - One Save makes two writes, venue then programme, so a failure in the second leaves the first applied.
   - The matrix skips it on purpose (`consistency.render.matrix.test.tsx:445`). Queue it.
3. **The New-event name step can replay the old name.** It keeps one key per screen (`flows/new/NewFlow.tsx:108`) whatever the typed name. After a lost reply, an edited name is replayed as the old one. Fix: key the step by name and format, as Cover does by URL.
4. **Two retry tests only check that a key exists, not that it is reused:** `change.flow.test.tsx:214` and `NewFlow.test.tsx:156`.
5. **The event-detail writes have no retry-key test of their own.** I swapped `flows/add/useFlow.ts:53` to `newIdempotencyKey()`. Every test under `events/**` and `__tests__/**` stayed green (16 files, 811 tests), and only the add and cancel flow tests went red. Their coverage is indirect, through the shared hook.
6. **Dead files with no production importer:** `events/EditorGroup.tsx`, `shell/placeholders.tsx` (kept on purpose per INT2), and `home/StaleLink.tsx` (imported only by its test). There are also deprecated one-line re-exports: `profile/useOrganiserChoice.ts` and `profile/profileForm.ts`.
7. **S6/S7 seam copy.**
   - Team says "Leave this team" (`team/index.tsx:82`, `Person.tsx:84`), but More's control says "Leave this page".
   - Person's "Add them back" opens the generic `/team/add` wall, not that person.
8. **`?o=`.**
   - Only `edit-in-place/parts.tsx:224` writes it. NewFlow carries it through correctly (`NewFlow.tsx:87,142`).
   - The comment at `NewFlow.tsx:76` says Events passes it, but `EventList.tsx:38` and `home/index.tsx:58` do not.
   - An unknown `?o=` falls back silently to `organisers[0]` (`switch/useOrganiserChoice.ts:45`).
9. **Done screen's `nextLabel` is consistent.** It has one field (`doneState.ts:15`), with a fallback in `Done.tsx:30`. The callers pass "Add them back", "Back to the event", and the default "Put it back".
10. **`ORG_PATHS.newEvent` and sign-out are clean.**
    - `ORG_PATHS.newEvent` has no caller outside `paths.ts`, and the legacy `events/new` route redirects to `newWhat` (`legacyPaths.ts:45`).
    - Both sign-outs (`more/SignOutSheet.tsx:11`, `home/onboarding/SignOutLine.tsx:13`) use `useSignOutToHome`. `auth.signOut` appears only in `hooks/useAuth.tsx`.
11. **`/page` tap targets.** In source, every control on `/page` is at least 44px high, apart from the compact 32x44 pencils the owner decision already covers. Examples: `page/index.tsx:69` `min-h-[52px]`, and `edit-in-place/parts.tsx:25,62,75,79,105,200,232` `minHeight: 44`. I measured source only, not in a browser.

## Write-path table (scope 1)

| Write path | Call | RPC | expected_version | Untouched Save sends nothing | Key reused on retry | Conflict view |
|---|---|---|---|---|---|---|
| New: name | flows/new/NewFlow.tsx:116 | series_command_p5 | n/a (create) | Next blocked | ref, per screen (N3) | error line |
| New: venue/date/time/cover/live | flows/new/useNewSend.ts:38 | series_command_p5 | yes (fresh read) | wizard | ref Map | EventConflict |
| Details field / venue | events/Details.tsx:39,89 | series_command_p5 | yes | yes (eventModel.ts:411; `:83`) | ref Map | EventConflict |
| Pause/resume/day/stop/end | flows/event/EventStep.tsx, EndStep.tsx | series_command_p5 | yes | yes | ref Map | EventConflict |
| Change time/venue/day | flows/change/useChange.ts:77 | occurrence_command_p5 | yes | yes (mutation-proved) | ref Map | copy #3 (S2) |
| Add date / cancel / put back (flow) | flows/add/useFlow.ts:53 | series/occurrence _p5 | yes | n/a | ref Map (tested) | copy #2 (S2) |
| **Put back on One event** | events/DatesTakenOff.tsx:31 | series_command_p5 | yes | n/a | **no (S1)** | **inline (S1)** |
| Cover fix | flows/fix/CoverFlow.tsx:51 | series_command_p5 | yes | n/a | per URL | EventConflict |
| Date page (main's) | dates/useDateEditor.ts | occurrence_command_p5 + programme | can be null (N2) | yes | no (N2) | inline |
| My page | edit-in-place/draftModel.ts:340 | organiser_profile_update_p5_v1 | RPC has none (S8) | yes (EditInPlaceLayer.test:130,308) | n/a | n/a |
| Team add/promote/remove | team/AddSomeone.tsx:52, Person.tsx:39,47 | add_member_by_profile / set_member / remove_member | RPC has none | n/a | n/a | n/a |
| Hand over | flows/handover/Confirm.tsx:29 | organiser_transfer_ownership_v1 | RPC has none | n/a | n/a | n/a |
| Leave | more/index.tsx:67 | remove_organiser_member_v1 | n/a | sole owner disabled | n/a | n/a |
| Claim / Ask to join | OrganiserSheet.tsx:90; PublicClaimCard.tsx:167,237 | claim_organiser_v1 / request_organiser_access_v1 | n/a | n/a | RPC takes no key | n/a |
| Create page | flows/newpage/NewPageFlow.tsx:64 | create_organiser_profile_v1 | n/a | n/a | `sending` ref | n/a |
| Sign out | more/SignOutSheet.tsx | useSignOutToHome | n/a | n/a | n/a | n/a |

## Access table (scope 3)

| Screen | Read | Non-member | Manager | Removed member | Signed out |
|---|---|---|---|---|---|
| Home, Events, Switch | organiser_home_v1 | own pages only; none goes to onboarding | full | page drops out after refetch | AuthGuard sends to /auth?returnTo |
| One event, Details, Cover, steps | admin_event_workspace_p5 | **"check connection" (B2)** | full | **B2** | /auth |
| Date line-up | workspace + event_view_p5 | load-error card | full | same | /auth |
| Team, Person, Hand over | organiser_team_v1 (falls back to the Home team) | a `?o=` they are not on falls back to their first page | role change disabled with a reason; add refused until A1b (known) | cached Home role until refetch; server refuses | /auth |
| Add someone | browse_people_v1 (**missing, S7**), search_people_v1 | n/a | search works | n/a | /auth |

**user_id vs profile_id (S6):**
- Every `:userId` consumer matches on `m.userId`: `Person.tsx:31,39,82`, `handover/Confirm.tsx:26,29`, `ToWhom.tsx:33`. Each passes it to `p_user_id` / `p_to_user_id`, which matches the prod signatures. This is correct.
- `AddSomeone.tsx:35-37` assumes profile id = user id when it filters out existing members. That holds on prod today: 0 claimed profiles have `claimed_by` different from `id`. It is an assumption, not a contract.

## Mutation proof (scope 4)

I ran each mutation in a separate worktree at `8dffd70`, ran the named test file, then reverted and confirmed it green again.

| # | Test | Mutation | Result |
|---|---|---|---|
| 1 | consistency.matrix: past-date sentence verbatim | `selfServeErrors.ts:130` "already happened" changed to "already passed" | **GREEN**, 14 of 15 rows (S9) |
| 2 | consistency.matrix: Live chip says Live | `page/index.tsx:84` `Live` changed to `Live now` | RED `expected [ 'Live now' ] to deeply equal [ 'Live' ]` |
| 3 | render.matrix: untouched Save sends nothing (change time) | `flows/change/Time.tsx:28` drop `&& value !== current` | RED `expected null to be 'true'` (3 failed) |
| 4 | render.matrix: version_conflict lands on the R3-7 view | `flows/change/parts.tsx:88` `ORG_PATHS.event(id)` changed to `ORG_PATHS.events` | RED `expected '/account/o/events' to be '/account/o/events/aaaaaaaa-...'` |
| 5 | s5.fixpass: same venue picked again, nothing sent | `events/Details.tsx:83` drop the `=== default_venue_id` guard | RED `expected [ {fn:'series_command_p5'} ] to have a length of +0 but got 1` |
| 6 | s5.events C37: one series.upsert carrying expected_version | `events/Details.tsx:39` `version` changed to `version - 1` | RED `expected 8 to be 9` (7 failed) |

S6 team-command code was not mutated: those RPCs take no version and no key.

## CI table

**Local sandbox** (`8dffd70`, compared against `origin/main` in a separate worktree):

| Step | Head | Main | Verdict |
|---|---|---|---|
| typecheck (`npm run typecheck`) | 97 errors | 97 errors, same messages (`diff` of the sorted lists is empty) | no new errors |
| check:rpc-typing, check:wallclock-brand | pass | n/a | ok |
| bin/check-integrity.sh | pass | n/a | ok |
| check:legacy-tables, check:legacy-program-rpcs | pass | n/a | ok |
| lint:architecture | pass | n/a | ok |
| check:images (AUDIT_STRICT=1) | pass | n/a | ok |
| check:mojibake | pass | n/a | ok |
| check:dancer-area-isolation | pass | n/a | ok |
| lint chain (`npm run lint`) | 19 of 20 pass; `check:integrity` exit 126 | n/a | sandbox exec bit (CI runs `chmod +x bin/*.sh`); the direct run passes |
| test:unit | 15 failed in 4 files / 8697 passed | the same 4 files: 15 failed | live-DB contract suites + integrity sandbox test; not this PR |
| build (`npm run build`) | pass | n/a | ok |
| check:bundle-budget | "All first-load JS budgets respected" | n/a | ok (S9 bump holds) |

**PR #809 checks on GitHub** (head `8dffd70`):

| Check | Result |
|---|---|
| unit (London, New York, Sydney), integrity, dancer-area-isolation, wallclock-brand, bundle-budget, e2e-smoke, phone-qa, contract-check, live-db-gate, masking/bom/notification checks, canaries | success |
| **build-smoke** | **failure**: 3 rows from B1, plus `auth-consent.build.spec.ts:63` (not traced) |
| phone-qa-section, real-data-verified | failure, PR-body checks (INTEGRATE2 already records these) |
| preview jobs (seo/og/synthetic/lighthouse/measure) | skipped (no preview) |

## Known context: checked that it still holds

- **Prod shapes still match the brief** (read-only SELECT, counts only, 2026-10-17):
  - 46 organiser pages and 50 active team rows, all role `Leader`.
  - 0 pages with no team, 4 teams of 2-5, 0 teams of 6 or more.
  - 746 `event_series_p5` rows.
- **Stale "Make owner" lines** at `selfServeErrors.ts:243` and `teamPickerModel.ts:159` are still present (known).
- **S9 perf budgets** hold: the chunk ratchets are at their allowances.

## Verified
- Write-path, merge-seam and authz findings: verified by reading the code at `8dffd70`. Each claim cited above was re-grepped.
- Mutation proof: 6 tests, 5 red and 1 green.
- Every local CI step listed above was run, with typecheck and unit compared against main.
- build-smoke B1: reproduced locally against the production build.
- Prod: shapes, the missing browse RPC, and the status distribution, all by SELECT only.

## Not verified
- **The `auth-consent.build.spec.ts:63` failure in build-smoke:** I did not trace its root cause, and I did not check whether it is also red on main.
- **No browser walk** at 390x844 against the prod-shaped matrix: 0, 1 and 10+ series, a team of 1 and of 2-5, ended/paused/cancelled-only/festival/course events.
- **No live check of what `_assert_can_edit_series_p5` returns** for a contributor or removed member. B2 relies on main's `isAccessRefusal` contract.
- **S6 team-command code** was not mutation-tested.
- **Vercel preview:** not checked, since this push is docs-only and the head preview was skipped.
