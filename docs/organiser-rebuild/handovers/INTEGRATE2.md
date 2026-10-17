# INTEGRATE2 -- S5 + S6 + S7 merged into `claude/org-r1-integrate`

Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/INT2-merge.md`. Ticket `dt_865fc6799806`. PR #809 (the integrate PR, base `main`).
Base: `fe2de2b1` (S1-S4 + F-INT).

## Merges (plain `git merge`, in order)

| Slice | Branch @ head | Result |
|---|---|---|
| S5 | `origin/claude/org-r1-events` @ 9818fa0d | clean |
| S6 | `origin/claude/org-r1-team` @ 1a1ad842 | 2 conflicts, resolved (below) |
| S7 | `origin/claude/org-r1-pagemore` @ d30c14f7 | 3 conflicts, resolved (below) |
| S9 | `origin/claude/org-r1-door` | **skipped: the branch does not exist on origin** |

`git grep -n "<<<<<<<"` on `src/` after each merge: nothing.

## Conflicts resolved (both real behaviours kept)

- `shell/OrganiserRoutes.tsx`: every lazy import now points at its real slice: `events/Details` (S5), `team/TeamFlow` + `flows/handover` (S6), `more`, `more/help`, `flows/fix`, `page` (S7). Route table: every R1 route once, `more/help` added by S7; no duplicates. No route points at `./placeholders` any more (the file stays, unimported).
- `shell/__tests__/routes.test.tsx`: the "answers until its slice lands (placeholder)" table emptied out (every slice landed). Replaced by a source test: OrganiserRoutes imports no `./placeholders`. Main-screen table keeps S5's `events/s1` + `events/s1/details` and S7's `page -> org-page-page`.
- `flows/doneState.ts`: ONE `nextLabel?: string` (both slices added the same field; only the doc comment conflicted). `Done.tsx` merged clean (`state.nextLabel ?? NEXT_LABEL`).
- New test row in `flows/__tests__/Done.test.tsx`: `it.each` over a team removal Done (S6, "Add them back") and `coverDone('s1')` (S7, "Back to the event"); each shows its own label and goes to its own `next`.

## Follow-ups

| # | Item | Status |
|---|---|---|
| a | `events/EventList.tsx` newEvent | Already on `ORG_PATHS.newWhat` (S5 did it). Scan TIGHTENED: `page/__tests__/Page.test.tsx` "ORG_PATHS.newEvent has no caller" now covers the WHOLE `src/modules/organiser` tree (only `shell/paths.ts` excluded). Mutant (EventList back to `newEvent`) -> red, restored -> green. **Done** |
| b | `/new/what` honours `?o=` | **Done** (10 lines, `flows/new/NewFlow.tsx`): WhatStep carries `?o=` into `/new/name`, where `useOrganiserChoice` selects that organiser; the name step's Back keeps it. Red-first test in `flows/new/__tests__/NewFlow.test.tsx` ("C19 keeps ?o=..."): two organisers, `?o=org2` -> URL keeps `&o=org2` and the draft `series.upsert` carries org2. Red before the fix (URL lost `o`), green after. |
| c | S0b review-strip patch | **Done**. `docs/organiser-rebuild/handovers/S0b-review-strip.patch`: 8 of 9 file diffs applied as-is; `shared/__tests__/organiserStatus.test.ts` drifted only because S7 already deleted its `reviewModel` import, so that file was written from the hunk's target side. `shared/useSendForReview.ts` deleted; `submitForReviewCommand` gone. No importer left (`git grep`). CRLF kept on every file. |
| d | Sign-out via `useSignOutToHome` | **NOT done.** The hook is on `origin/main` (`src/components/account/profiles/signOutToHome.ts`, #789 c36fbaf) but NOT on this branch's base, and it relies on #789's `useAuth().signOut` `leave` step. Switching needs `origin/main` merged into the integrate branch first (out of this brief's scope). Then switch `home/onboarding/SignOutLine.tsx:13-26` and `more/SignOutSheet.tsx:12-20` (its comment already says so). |
| e | S7 `!important` for eip-dock | **NOT done, no one-line fix.** `page/useOwnPage.tsx:18` `DOCK_ABOVE_SHELL`. The dock's z-index is `BAR_Z` in `edit-in-place/EditInPlaceLayer.tsx:424`, shared with the public event page's layer order (`edit-in-place/layers.tsx:22-24`); the proper fix is a `dockZ` prop on EditInPlaceLayer passed by `useOwnPage` (several lines, two files). |

Also fixed (made red by the S7 merge, test-only; the phone spec is in the CI table): `tests/e2e/organiser-layout.spec.ts` still drove the retired `/account/o/profile` editor (`profile-send-review`, `profile-name`, `profile-bar-preview`). Green on base, red after S7. Now: "Page and More" tap targets (`/page`, `/more`), the slim-bar test checks `/page` shows no `eip-bar` when nothing is drafted, and the sideways-scroll list covers `/page`, `/more`, `/more/help`.

## Cross-slice checks

- Every `ORG_PATHS` key linked from `home/`, `jobs/`, `more/` (Help rows included) and `flows/Done.tsx` (add, addEvent, cancel, change, cover, event, events, handover, help, home, more, newWhat, page, switch, team, teamAdd) matches a route in `OrganiserRoutes.tsx`. `more` "Add a page" goes to `${home}?add=1`, which Home reads.
- **Naming mismatch (not picked, owner decides):** `home/index.tsx:116` titles the add screen "Add an organiser" and `home/onboarding/OnboardingView.tsx:98` says "Add another organiser", while `more/index.tsx:88` and `switch/index.tsx:80` say "Add a page" (and `page/index.tsx:33` "Add a page from Home").
- **S6 depends on admin A1b** (`claude/org-r1-admin`, migration `20261126190000`): until it is applied on prod, a manager tapping a team-add surface gets the `owner_only` copy ("Only the owner can add people..."). R1 must not ship before A1b (S6 handover, "DEPENDENCY").

## CI, run in the sandbox (GitHub Actions not relied on)

| Job / step | Command | Exit | Note |
|---|---|---|---|
| typecheck | `npm run typecheck` | 2 | 96 errors = 96 on base fe2de2b1, same file set (`diff` empty). Base-identical. |
| unit-tests | `npm run test:unit` | 1 | 346/350 files pass, 7991 tests. 4 failing files are the known sandbox-only ones (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` contract tests need the network; `integrityCouldNotRun`). |
| lint chain | `npm run lint` | 1 | 17/18 links PASS; `check:integrity` exit 126 = `bin/check-integrity.sh` is mode 100644 in git (same on base; CI runs `chmod +x bin/*.sh` first). `bash bin/check-integrity.sh` -> 0 (1802 files, 0 issues). eslint link skipped (informational). |
| architecture-guard | integrity, legacy-tables, legacy-program-rpcs, lint:architecture, image-widths (+self-test), plan-hygiene self-test, workflow-artifact-policy, mojibake self-test | 0 each | via the lint chain + direct runs |
| mojibake git grep | the workflow's `git grep -nE ...` | no match | clean |
| images | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| build | `NODE_ENV=production npm run build` | 0 | |
| perf-budget | bundle-budget, first-load-requests, chunk-cycles (each + self-test) | 0 each | |
| perf-budget (preview) | `check:doc-weight`, `check:lighthouse` | n/a | need a live Vercel preview (`GITHUB_REPOSITORY` / preview URL); not runnable pre-push |
| e2e-smoke | `npm run test:e2e` | 1 | 139 pass / 7 red on first run. After the layout-spec fix, `organiser-layout` 26/26 with dancer-home. Remaining red, all base-identical (same specs re-run on a fe2de2b1 worktree): `organiser-loop.spec.ts:14` (stale, S8's), `auth-magic-link-returnto.spec.ts:88/113` and `dancer-home.spec.ts:93/105` (cold-start timing; a different subset each run, base too). `organiser-events.spec.ts:199` passed here. |
| phone-qa (phone) | `npx playwright test --config playwright.phone.config.ts` | 1 -> fixed | 178 pass / 10 red: all `e2e-phone/organiser-name-city-create.phone.spec.ts` (5 tests x 2 sizes), green on base, red after S7 (S7 moved the edit layer's Create event link to `/new/what?o=`, pinned by unit `visibility.matrix`; the spec still wanted `/events/new?o=`). Spec updated (4 lines, the visitor test's `a[href^=]` too, so it is not vacuous); re-run 18/18. |
| phone-qa (build) | `npm run build` + `npx playwright test --config playwright.build.config.ts` | 1 | 59 pass / 3 red: `public-journeys.build.spec.ts:234` M14, M35, M53. Base-identical (same 3 red on a fe2de2b1 worktree build). |
| phone-qa-section, real-data-verified | PR-body checks | n/a | PR #809 body is the integrator's, not changed here |

## Verified

- Every merge, conflict and follow-up above; touched unit files green (`routes`, `Done`, `NewFlow`, `Page`, `shared/*`); full unit suite and every runnable CI step after the last code change, results as in the table.
- Red-first for (b); killed mutant for (a).

## Not verified

- No prod shape survey (Supabase) this pass; no browser walk at 390x844 beyond the e2e fakes; no phone.
- No Vercel preview (doc-weight, lighthouse not run).
- GitHub PR checks not read after the push.
- A manager team-add against prod (needs A1b).

## Next steps

1. Owner: pick "Add a page" vs "Add an organiser".
2. Merge `origin/main` into the integrate branch, then do (d).
3. (e) as a small `dockZ` prop.
4. S9 (`claude/org-r1-door`) when it exists with a `[worker-done` subject.
5. Apply admin A1b before R1 ships.
