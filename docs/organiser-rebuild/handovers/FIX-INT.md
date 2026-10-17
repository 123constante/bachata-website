# FIX-INT: one fix pass on PR #809 from the two whole-diff reviews

- Branch: `claude/org-r1-integrate`
- Base head: `8dffd70c`
- Sources: REVIEW-INT-A (correctness and data) and REVIEW-INT-B (copy, a11y, layout), fix brief F-INT-fix.
- Workers: G1 (status words, dates, empty states, `?o=`), G2 (access refusal, conflicts, Put back, MonthDots), G3 (team copy, focus, a11y, pencils), G4 (build-smoke, routes, dead files), plus a final verifier (module-wide raw-Unicode row, CI run, this file).

## Done

Every item on the work list is done with a test, except the items listed under Queued.

- BLOCKING: the build-smoke `home-dates` seam is fixed. The `auth-consent:63` red was traced: it is base-identical and does not reproduce here. Every workspace reader screen now shows the no-access copy with no retry. There is one status-word mapping (`LIFECYCLE_CHIP` is deleted).
- SHOULD: all 17 items are done (A-S1, S2, S4, S5, S6, S9; B-S1 to S11).
- NOTE: all items are done (A-N1, N3, N6, N7, N8; B-N6, N7, N8, N9). N-10 was real, so it is fixed.
- Owner decision: the /page pencils are 44x44 inside `.org-theme`, and the public page is unchanged. The width exemption is removed from `tests/e2e/organiser-tap-targets.spec.ts`.
- Verifier: the raw-Unicode matrix row is widened to all non-test source in the module (comments excluded). It was proved with a mutant: a raw em dash in a string is caught, and one in a comment is ignored. The `account.today` regression snapshot was updated for decision 4: "Asked 1 Oct" became "Asked Thursday 1 October", in 4 rows.

## Red-first table

Each row's test was run on the unfixed tree first (red), then on the fixed tree (green). Raw logs are in the scratchpad (`g1/`, `g3/`, `ev/G4-*.log`).

| item | red message (short) | green |
|---|---|---|
| A-B1 / B-B2 build-smoke `home-dates` | `Locator: getByTestId('home-dates')` END-screen timeout x3 (M14, M35, M53), exit 1 | public-journeys + auth-consent: 36 passed. The rows now wait for `home-jobs` |
| auth-consent.build.spec.ts:63 | not reproducible. origin/main 3/3 passed, branch passed. The spec, its harness and the auth code are identical to main | no fix: a CI-runner timing flake (base-identical) |
| A-B2 no access (9 screens: One event, Details, Cover, Cancel confirm, Cancel which date, Add which day, Add time, Change time, New first date) | `Unable to find an element by: [data-testid="org-no-access"]` x9 | 10/10 (plus: a signed-out caller keeps its retry) |
| B-B1 / A-S3 / B-S2 status words (all 7 lifecycle_status values) | `expected 'pending_review' to be 'In review'`; `expected 'rejected' to be 'Changes needed'` (source and rendered My events / One event) | 7/7 + 7/7 |
| B-S2 inline literals (homeJobs, page, switch, add/WhichEvent, EditorRows) | `[ 'Draft','Live','Paused','Ended','Archived','Live' ]`, `[ 'Live' ]` x2, `[ 'Draft' ]`, `[ 'Cancelled' ]` | 5/5. `CANCELLED_WORD` is a single export |
| A-S1 Put back via useFlowSend | `Unable to find ... [data-testid="event-conflict"]`; retry `expected 'd7e26afe-...' to be '1e0ccbf5-...'` | pass: the same key is reused, and a conflict shows the R3-7 view |
| A-S2 one conflict view | `expected [ 'flows/add/parts.tsx', ...(2) ] to deeply equal [ 'flows/event/parts.tsx' ]` | pass. All 13 CONFLICTS rows are green |
| A-S4 + B-N1 one owner_only / role-help string | `expected 'undefined' to be 'string'` (no `OWNER_ONLY_ADD` / `ROLE_HELP`) | pass |
| A-S4 "Make owner" in error copy (with admin `inviteModel.ts`) | 3 hits: `teamPickerModel.ts`, `selfServeErrors.ts`, `admin-organisers/inviteModel.ts` | pass. The admin pin in `polish.test.tsx` was flipped |
| A-S5 review clause | `teamPickerModel.ts` / `team/Person.tsx`: "...send it for review" | pass |
| B-S10 "page" wording, managers add | `not_authorised: "Only an owner of this organiser can do that. As a manager you can leave the team."` + 3 more | pass |
| B-S3 / A-N7 "Leave this page" | `expected 'Leave this team' to be 'Leave this page'` x2 | pass |
| A-N7 Add them back | `expected '' to be 'Ana Maria'` | pass: `/team/add?q=` prefills the search |
| A-S6 routes.test (12 routes, duplicate dropped) | coverage gap (the routes were not mounted at all; the review's grep found nothing) | 40/40 |
| A-S9 past-date pin | mutant "already passed" left the OLD test GREEN; the new test is red `expected 'This date has already passed...'`; mutant 2 is red on the file list | 4/4 |
| B-S1 one full date formatter | `'Home job line': 'Fri 23 Oct'` ... vs `Friday 23 October`; short-name scan `[ shared/homeModel.ts, shared/teamModel.ts, ui/londonDate.ts ]`, then `onboardingModel.ts` | pass (`shared/dateWords.ts fullDate`) |
| B-S4 no events at all | `expected 'No coming datesAdd a date' to contain 'No events yet'` (change, cancel) | 4/4. "No coming dates" is kept for events whose dates are all past |
| B-S5 (a) empty after filter / (b) Retry + alert | `Unable to find ... add-no-results` / `... add-search-error` | pass |
| B-S6 MonthDots | `Unable to find ... [data-testid="org-month-weekdays"]` | pass (weekday row, sr-only on/cancelled) |
| B-S7 line-clamp-2 | `expected '<span className="min-w-0 flex-1 trunc...' to match /\bline-clamp-2\b/` x2 | 2/2 |
| B-S8 (a) returnFocusRef at 6 SheetView sites | 6 x `expected '<SheetView ...' to match /returnFocusRef=\{/`; `expected <body> to be <button>` | 8/8 |
| B-S8 (b) Person confirm role=group | `expected 'alertdialog' to be 'group'` | pass |
| B-S8 (c) leave guard trapTab + refocus on Stay | `expected <button> to be <button>` (Tab escaped); `expected <body> to be <a>` | pass |
| B-S9 Field note id + DateSheet aria | `expected null to be 'true'` | pass |
| B-S11 removed-row chip --fg | `expected 'inline-flex ...' to match /text-\[var\(--fg\)\]/` | pass |
| A-N1 shared isVersionConflict | `expected [ 'flows/fix/CoverFlow.tsx', ...(1) ] to deeply equal []` | pass |
| A-N3 name+format key | `expected '142bd793-...' not to be '142bd793-...'` | pass |
| A-N8 `?o=` on New event | `expected '/account/o/new/what' to be '/account/o/new/what?o=org2'` x2; fallback `...?o=org1` | 3/3 |
| A-N6 dead files | grep: the only importers were the files themselves and StaleLink's own test | `EditorGroup.tsx`, `StaleLink.tsx` and its test deleted; `placeholders.tsx` kept |
| B-N6 motion-reduce spinners | `+ shared/components/EmailCodeProof.tsx` x2, `+ PublicClaimCard.tsx` x3 | pass |
| B-N7 Tap Resume | `+ "shared/editorGuards.ts: Press Resume any time..."` | pass |
| B-N8 raw Unicode | teamModel `’`; DatesTakenOff `[ '…' ]`; selfServeErrors / contactModel / teamPickerModel `[ '’','’' ]`, `[ '…' ]`, `[ '…','“','”','’','…' ]`; verifier mutant `[ 'zzMutant.ts: U+2014' ]` | module-wide row green; `check:mojibake` clean |
| B-N9 cancelled-only first | `expected { label: 'Needs dates' } ... { label: undefined }`; festival `{ label: 'Needs a cover' }` | 3/3, plus a control row |
| N-10 city UUID | `"...City came back different (we will show: c2000000-...-000000000002)"` | pass ("we will show: Manchester") |
| Owner: /page pencils 44x44 | `expected { width: '32px' } to deeply equal { width: '44px' }` | pass. The public page stays 32x44. The e2e width exemption is removed |

## Decisions (orchestrator; the owner can overrule)

1. **Managers can add people.** The shared `OWNER_ONLY_ADD` / `ROLE_HELP` copy says owners and managers add people. **Ship blockers:** admin **A1b** (manager-add) and admin **A1**: the browse RPC `organiser_team_browse_people_v1` is missing on prod, so the /team/add browse wall fails today. Neither needed a code change here. Until A1b ships, a manager who is refused sees the "owner or a manager" line.
2. **"page", never "organiser", in team copy.** TEAM_COPY `organiser_id_required`, `not_authorised`, `organiser_not_found`, `owner_only` and `use_transfer` were reworded, and Team says "Leave this page". The onboarding "organiser" wording (N-11) is unchanged.
3. **A cancelled-only event outranks EVERY Home problem**, not only "Needs a cover". My events and One event show `Cancelled` (bad tone) ahead of "Needs dates" too. Home's job rows are unchanged, and homeJobs.matrix records that one exception.
4. **One full date formatter** (`shared/dateWords.ts fullDate`), used by homeModel, eventModel, dateCap, eventState, teamModel, londonDate, dateList and onboardingModel. onboardingModel was a 6th site the review missed. The DateChip month glyph stays short.
5. **The review clause is removed** from every role explainer.
6. **Do-not-fix items** are under Queued. Only one N-7 wording change was made, under a **read-only exception**: `shared/editorGuards.ts:105` "Press Resume" became "Tap Resume". That one word is the only change to that file.
- **N-10 outcome:** real. The notice showed the city UUID. It now names the city, or says "the city you picked".
- **No-access copy:** the title is main's, verbatim: "You do not have access to this event". The body is "Only the owners and managers of this page can edit it. Ask one of them to add you to the team." There is no button, because the shell's Back link is the way on.
- **Build-smoke testid:** the rows wait for `home-jobs`, not `org-page-home` or `home-job`. `org-page-home` is also on the onboarding / Add-a-page shell, and `home-job` matches many rows, which breaks strict mode.
- **Hand-over wording** is one fragment, `HAND_OVER_HOW`: "add them as a Manager, then open their name and tap Hand the page over".
- **Pencil size** is set by CSS scope (`.org-theme .eip-pencil--compact{width:44px}`), not by a prop.
- **B-S8 (a)** uses a shared `ui/useOpenerRef`, which remembers the last control pressed.
- **The EmailCodeProof byte pin** (`Door.test.tsx`) now hashes after stripping the B-N6 class.

## Queued (not done, with reasons)

- **INT-A S8:** admin `p_expected_version` on `organiser_profile_update_p5_v1`. It needs an admin migration, and this repo owns none.
- **INT-A NOTE-2:** main's date page (`dates/useDateEditor.ts`). It has no idempotency key, it sends `version ?? null`, and one Save makes two writes. It also has **no no-access branch**: `useDateEditor` reads `admin_event_workspace_p5`, but the whole page is queued.
- **INT-B N-3:** footer.
- **INT-B N-7:** wording drift, except "Tap Resume" (done).
- **Build-smoke M77 flake:** `tests/e2e-build/account-edges.build.spec.ts:154` (`profile-switcher-side-organiser:` count 0) fails intermittently. The rate is the same on the base head: **3/6 at 8dffd70 and 4/6 on this tree**. It passed in G4's earlier full run, and the CI run of #809 did not list it. So it is not caused by this pass. It needs its own look (the switcher sheet is opened while B's sides are still loading).
- From G2:
  - `flows/change/WhichDate.tsx` renders from the Home read only, so it gets no NoAccess row.
  - The NewFlow Venue, Time and Cover steps have no workspace error state of their own.
- From G3:
  - Spinners outside `src/modules/organiser` (`*CityPicker*`, `AuthGuard`, search) still lack `motion-reduce:animate-none`.
  - On iOS, Stay in the leave guard cannot refocus a link that was tapped, because it never had focus.
  - `shared/seriesModel.ts:264` still has a raw `…` in a **comment**. It is a read-only imported file, so it is out of B-N8 scope (that item covers strings), and the module-wide row excludes comments.
- From G1: there was no 390-wide browser check of the longer full-name dates inside `truncate` rows (for example EditorRows `shortDate`) or of the line-clamp row height.

## Per-job CI table (local sandbox, final tree)

| job (workflow) | command | exit | note |
|---|---|---|---|
| typecheck (local gate) | `npm run typecheck` | 2 | 97 errors = the 97 baseline. 1 is in the organiser module (`TeamPicker.test.tsx:297`, pre-existing, file untouched) |
| lint chain | `npm run lint` | 1 | 19/20 links PASS. `check:integrity` exit 126 = the script's exec bit in this sandbox (CI runs chmod first). eslint SKIPPED by the chain |
| Source Integrity: integrity | `bash bin/check-integrity.sh` | 0 | 1874 files, 0 issues |
| Source Integrity: legacy-tables / legacy-program-rpcs / lint:architecture | `npm run check:legacy-tables` etc. | 0 | in the lint chain |
| Source Integrity: images | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| Source Integrity: image widths, plan-hygiene canary, artifact policy, mojibake canary + guard, entry-point proof | the `npm run` steps | 0 | all 0 |
| eslint (pre-ship ratchet, changed files) | `npx eslint <87 changed files>` | 1 | 11 errors, all pre-existing: the counts at HEAD are the same (EditInPlaceLayer 4/4, PublicClaimCard 7/7) |
| Unit & Contract Tests | `npm run test:unit` | 1 | 8803 passed, 19 failed in 5 files. 15 in 4 files are the known set (eventViewCompat, occurrenceProgram, publicEventPageLineup = live DB; integrityCouldNotRun = sandbox). The other 4 (`account.today` snapshot "Asked 1 Oct") were caused by decision 4: snapshot updated, 36/36 green |
| Unit: dancer-area-isolation | self-test + `npm run check:dancer-area-isolation` | 0 | |
| Typecheck workflow | `npm run check:rpc-typing`, `npm run check:wallclock-brand` | 0 | |
| Perf Budget | `npm run build` (perf env), `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` (+ 3 canaries) | 0 | budgets respected; 6/6 request pins match |
| E2E Smoke | `CI=1 npm run test:e2e` (e2e env) | 0 | 158 passed, 1 skipped; includes `organiser-tap-targets.spec.ts` |
| Phone QA: build-smoke | `CI=1 npx playwright test --config playwright.build.config.ts` | 1 | 65 passed, 1 failed: the M77 flake (base-identical, see Queued) |
| Phone QA: phone suite | `CI=1 npx playwright test --config playwright.phone.config.ts` | 0 | 272 passed, 74 skipped (13.0m) |
| Workflow Lint | `lint-workflow-masking`, `lint-workflow-notification` (+ self-test) | 0 | |
| DB Contract Check (offline steps) | `check-migration-stamps`, `ci-live-db-gate --self-test`, `check-guest-list-contract --self-test` | 0 | the live-DB steps need secrets: not run |
| pre-ship | `npm run pre-ship` | not run | the sandbox permission classifier refused it (it cleans `build/`); its parts (build, budgets, typecheck count, eslint on changed files, unit) were run one by one above |
| not runnable here | db-contract live checks, types-drift, OG/SEO/synthetic SSR (need a live deploy), phone-qa-section / real-data-verified (PR body), bot/dependabot automerge, Lighthouse | n/a | |

## Verified / Not verified

Verified:
- Every work-list item has a red run against the unfixed tree and a green run after the fix (table above).
- The CI steps in the table were run locally against the final tree.
- The production build passes, and the build-smoke passes except the base-identical M77 flake.
- The tap-target e2e passes with width checked.

Not verified:
- No browser walk at 390x844 of the new screens with prod-shaped data. This covers no-access, NoEventsYet, MonthDots, full-name dates in truncating rows, and line-clamp row height. The e2e specs run at 390 on fixtures only.
- No real iPhone and no VoiceOver.
- No live-DB contract suites (no secrets).
- GitHub Actions have not run on the new head.
- Vercel preview not checked.
- No shape survey re-run on prod in this pass.

## Next steps

1. Commit and push once. The commit body carries the CI table (`ev/ci-table.txt`). Then watch the GitHub checks on #809, including `pr-mergeable-guard`.
2. Run `/code-review` on the diff: two rounds, because the change is user-facing.
3. Browser walk at 390x844 (Not verified, first bullet), then Ricky's phone test.
4. Admin: ship A1 (browse RPC) and A1b (manager-add) before R1 ships. Queue INT-A S8 (`p_expected_version`).
5. Open separate items for the M77 build-smoke flake and the queued date-page (NOTE-2) work.
