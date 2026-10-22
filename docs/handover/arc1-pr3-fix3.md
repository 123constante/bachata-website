# Arc 1 PR 3 fix pass 3 (`claude/arc1-pr3-claim`) &mdash; handover

Brief: admin `brief/arc1-organiser-onboarding-2026-10-21` `docs/briefs/arc1/arc1-pr3-fix3.md` (sha b1bd5ac). Ticket dt_f7adcde0ff6f.

## Done

| # | What | Where |
|---|---|---|
| 1.1 | ONE pure `goLiveView(answer, eventName, seriesId, organiserId)` decides the screen from the check answer: ready = "All set" + Go live on; not ready = "Almost there", "N thing(s) left before X can go live.", the list, Go live OFF with "Finish the list above first." (`aria-describedby`); loading = "Checking..."; failed = "Could not check. Try again." + Try again button. "Ready" words and the list never show together (a `ready:true` with a listed gap reads as not ready). | `golive/goLiveModel.ts`, `GoLiveFlow.tsx` |
| 1.2 | Go live pressed anyway and refused: the refusal payload goes through the same `goLiveGaps` mapping, shows the list and "Not yet. <first item>." (role=alert); the check is re-asked, and a check fetched after the refusal replaces the refusal's list. | `GoLiveFlow.tsx` |
| 1.3 | Home. Home never read the event check: "Ready to publish" is the PROFILE level (`levelName`, shown when `requiredLeft` is 0) and the to-do count is the number of Home job rows. Chosen fix is the brief's wording route: the profile card now reads "Profile: Ready to publish". Not merged into one shared mapping (they count different things); see Left. | `home/ProfileButton.tsx` |
| 2.1 | `invalidateAfterAnswer` returns a promise that settles when the refetches finish; the go-live answer path awaits it before moving on, so the next patch is built from the saved entity. | `wizard/wizardApi.ts`, `GoLiveFlow.tsx` (`ProfileWizard.tsx` calls it with `void`) |
| 2.2 | A null/unknown city is never sent as `""`: `buildOrganiserProfilePatch` leaves `city_id` out. | `src/lib/organiserProfileUpdate.ts` |
| 2.3 | City-name lookup: 3 s timeout (`CITY_NAME_TIMEOUT_MS`), failure or timeout gives `cities: null`. Go-live loading ends after 8 s (`LOAD_TIMEOUT_MS`) in "Your profile is taking too long" + Try again. | `profile/organiserPublicProfile.ts`, `GoLiveFlow.tsx` |
| 3 | Done screen after "Ask to join": title "Asked to join <page>", message "We will check your request and the page team will be in touch." (`askedToJoinDone`, wording follows the "we will check" line already in `claimStates.ts`). | `onboarding/claimStates.ts`, `OnboardingView.tsx` |
| 4 | `whichPage.ts` renamed `whichPageModel.ts` (git mv, imports and test updated). New test `src/lib/__tests__/noCaseOnlyDuplicates.test.ts` fails when two tracked `src/` files share a module path ignoring case. | `flows/new/` |

Red first (new tests run against the unchanged sources, 12 failed in the go-live / city / patch files; the case test failed on the existing `WhichPage.tsx` + `whichPage.ts` pair; the Door test failed on the old identical message).

## Left / for the owner

- 1.3: if the owner wants Home to show event items ("Page ready, 6 things left on the event") that needs Home to call `series_go_live_check_v1` per draft. Not done: it is a new read on Home and the brief allowed the wording route.
- 2.1: the saved profile returned by the save is not written into the cache directly; the awaited refetch is used instead (the brief allows either).
- The case test checks tracked files only (`git ls-files src`).
- Not walked at 390x844 (no local database with prod-shaped rows in this sandbox): which-page 7b, cannot-create 8a/8b.
- Existing go-live tests that click Go live now wait for the check; the default RPC fake answers a ready check.

## Verified on real data

Shapes surveyed: none read from production in this run (Supabase was not queried). The shapes in the tests are the ones the brief reports from the orchestrator's walk: ready true; not ready with 1 and 6 missing items; recommended only; ready:false with empty lists; ready:true with a listed gap; check failed; check loading; refusal after click.
Checks run: see the table below.
NOT verified: any of this against production data; a real phone; the Vercel preview.

| Job / step | Command | Exit |
|---|---|---|
| typecheck | `npx tsc --noEmit -p .` | 0 |
| typecheck.yml | `npm run check:rpc-typing`, `npm run check:wallclock-brand` | 0, 0 |
| architecture-guard | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0, 0, 0 |
| script conventions | `npm run check:script-conventions` | 0 |
| build | `npm run build` | 0 |
| unit-tests | `npm run test:unit` | 1: 15 failed / 11710 passed, in `tests/eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract` (live-DB contracts, no secrets in the sandbox) and `integrityCouldNotRun` (sandbox); none touch files changed here |
| dancer-area-isolation | `npm run check:dancer-area-isolation` | 1 (compares the branch to the dancer-rebuild base; it lists dozens of files this change did not touch, e.g. `src/pages/__tests__/DJProfile.test.tsx`; same on the branch before this change is not proven here) |

Not run: `check:images` / integrity (needs the full CI image audit), e2e smoke (needs a browser build and a database), live-db gates (no secrets), perf-budget (needs the deploy).

## Phone QA

Sizes checked: none (no browser walk in this run).
Walked: nothing.
Not verified: 390x844 layout of the new "Almost there" screen, the reason line and Try again button, and the stuck-loading screen. New elements reuse `PrimaryButton`/`GhostButton`/`ErrorState` (44 px tap targets); the reason line is 14 px text above the button, no horizontal scroll expected.
