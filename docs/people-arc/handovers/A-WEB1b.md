# A-WEB1b handover: profile wizard + Home "Complete your profile" + My page / Team / copy

Branch `claude/people-a-web1b-wizard` from `origin/main` (9d283c57, carries R1 #809). Ticket dt_c5ed1d2dcf32. No PR opened.
Status: **all five items built and tested; not a PARTIAL.**

## What was built

| Item | Files | Notes |
|---|---|---|
| Pinned files | `src/modules/organiser/shared/profileProgress.ts` (byte-identical from PINNED-profileProgress.md), `src/modules/areas/wizardStep.ts` (blob `a8bca66f`, identical to `origin/claude/people-b-web1-areas`) | A-DB1 handover key names checked: `{percent, required_left, publish_ready, steps[{area, field, required, done}], declined}` match the pin. |
| 1. Wizard | `wizard/ProfileWizard.tsx` (route `complete` = `PROFILE_WIZARD_PATH`), `wizard/registry.tsx` (steps keyed `area:field`), `wizard/stepKinds.tsx` (text, long text, choice, list, search-and-pick, upload, answered-elsewhere), `wizard/wizardModel.ts` (pure rules), `wizard/wizardApi.ts` (save one answer), `wizard/dancerApi.ts`, `wizard/wizardCountries.ts`, `wizard/LevelTrack.tsx` (ring, bar, level track, celebration), `wizard/nudgeStore.ts`, `wizard/wizardEnv.ts`; `shell/OrganiserRoutes.tsx` (+lazy import, +1 route) | Server order only (`steps`); a step with no registered component is skipped. Resume = first step not done and not answered/skipped in this visit. |
| 2. Home | `home/ProfileButton.tsx`, `home/index.tsx`, `jobs/homeJobs.ts` | ONE button: ring + "Complete your profile" + level (Starter line: "Starter. Finish your profiles, N left"). The first-steps job "Add a photo" (`add_cover`) is removed (it was the profile checklist job). D50 auto-open + Finish later 24 h + Not now 30 days x2 in per-user localStorage, all try/catch. |
| 3. My page | `page/index.tsx` (`RequiredLine`), `edit-in-place/FieldSheet.tsx`, `edit-in-place/fieldRules.ts` | "Required to publish: N left" link to the wizard, only while `required_left > 0`. Logo copy: `FIELD_LABEL.avatar_url` = "Organisation logo" (the ONE label map: My page row, Add button, notices), sheet buttons "Choose a logo / Remove logo / Uploading your logo". |
| 4. Team | `team/PublicToggle.tsx`, `team/publicTeamApi.ts`, `team/index.tsx` | Own row only. Reads the public row (`organiser_team_members`, `is_active`), writes `organiser_team_set_public_v1` (string-named boundary, refusing parser). Says what visitors see; disabled with a reason when the person has no dancer profile; `team_full` has its own words (20 shown on the page). |
| 5. Errors | `shared/selfServeErrors.ts` | `organiser_invite_required` and `team_full` were already mapped by #809 (checked). ADDED to `TEAM_COPY`: `profile_required`, `not_on_team`, `invalid_arguments` (the new codes of `organiser_team_set_public_v1`). `flows/newpage/**` needed no change. |

### Writers (no second mapping)
- Dancer: `save_my_dancer_profile_v2({p_payload: {<one key>}})`, read `my_dancer_edit_v1`, through `wizard/dancerApi.ts`. The dancer-app module may not be imported from here (`check:dancer-area-isolation` rule c; adding a seam is an orchestrator decision), so the wizard has its own string-named boundary for the same two RPCs; after a save it invalidates `['my-dancer-edit']` and `['profile-completion']`.
- Organiser: `draftModel.saveDrafts(client, id, base, { <FieldKey>: value })`, the exact save My page uses (prunes unchanged drafts, sends the socials-safe full form).
- Every saved answer invalidates `profileProgressQueryKey(id)` and `['my-profile-progress']` (pinned note).

### Field coverage (server key -> step)
Dancer required: all 9 (photo opens the dancer app crop screen `/app/me/photo?return=/account/o/complete` and comes back; `phone_or_whatsapp` writes `whatsapp`). Dancer optional: surname, bio, website, favourite_styles, achievements. **Skipped (no self-serve writer):** dancer `gallery`, `partner_search`; organiser `contact_email` (admin-only), `address`, `maps_link`, `gallery`. Organiser required: all 7; optional bio, website, facebook. Teacher/DJ: skipped until Release B (register them in `registry.tsx`).

## Decisions made (and why)
1. **Back on the first question = Finish later.** Otherwise Home re-opens the wizard at once (D50 loop).
2. **"Organisation logo" changed in `fieldRules.ts` FIELD_LABEL** (not in my file list) because it is the one label map; changing only FieldSheet would have made two words for one fact. One knock-on test line in `EditInPlaceLayer.test.tsx` ("Add organisation logo").
3. **`shell/__tests__/noHandBuiltLinks.test.ts`**: `shared/profileProgress.ts` added to KNOWN, because the pinned file spells `/account/o/complete`. A-WEB1a needs the same line; identical edit merges clean.
4. **Country list**: `wizard/wizardCountries.ts` repeats the 6-line rule of `src/constants/countries.ts` over the same `world-countries` data, because importing that module made it its own chunk and the dancer-app chunk ratchet went 56 > 55 (measured). Orchestrator may prefer a manual chunk instead.
5. **Milestone** shows when the person leaves the last required step; it celebrates only once the re-read progress says `publish_ready`, else it says answers are still missing with ONE button ("Answer them").
6. Unlock lines (C16, real effects only): Ready = "You can now put your events live."; Full = "Nothing is left to fill in. You can still change any answer on My page."
7. Snapshot `tests/regression/today/__snapshots__/account.today.test.tsx.snap`: 4 lines `button "Add a photo"` removed (the intended Home change), nothing else.
8. Not done: Go live's profile row and the switcher link (C15) live in A-WEB1a's / `profile/` files, not mine; they should link `PROFILE_WIZARD_PATH`.

## Red first
`homeJobs` (the one behaviour that changed): updated tests run against the unfixed `homeJobs.ts`:
```
FAIL homeJobs.matrix > 0 series -> the two first steps ... no profile checklist job (C15)
AssertionError: expected [ 'create_first_event', ...(2) ] to deeply equal [ 'create_first_event', 'add_manager' ]
FAIL homeJobs.matrix > paused + ended only -> the two first steps
FAIL Door.test > ... Home reads the three first steps
Tests 3 failed | 57 passed
```
then green. Everything else is new code (wizard, Home button, line, toggle): on main its tests fail at import. Mutation: removing the "unchanged answer sends nothing" check in `wizardApi.ts` turns "an untouched answer sends nothing" red.

Tests: `wizard/__tests__/ProfileWizard.test.tsx` (21: server order, skip done, resume, unregistered skipped, no Skip on required, D26 label/Optional hint/Skip-vs-Continue/choice on tap, D27, untouched sends nothing, one key, organiser one-field draft, own check before send, failed save keeps answer, milestone + level track, 100% screen, Finish later, Back, 44 px) and `wizard/__tests__/homeAndModel.test.tsx` (35: levels, D50 table, throwing storage, answers, Home button percent/level = RPC and opens wizard, auto-open, Not now, 100%, failed read shows nothing, My page line, Team toggle states, tap, team_full, no profile).

## CI table (this sandbox, final tree)
| Workflow / job | Step | Command | Exit |
|---|---|---|---|
| architecture-guard | integrity | `chmod +x bin/*.sh && bin/check-integrity.sh` | 0 (126 without chmod: sandbox exec bit; CI chmods) |
| architecture-guard | lint chain | `npm run lint` | 1: only `check:integrity` exit 126 (exec bit, above); all 19 other links PASS |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 |
| architecture-guard | images | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | image widths | `npm run check:image-widths` | 0 |
| architecture-guard | legacy tables / program RPCs | `npm run check:legacy-tables`, `check:legacy-program-rpcs` | 0, 0 |
| architecture-guard | mojibake / entry point | `check:mojibake:self-test`, `prove:entry-point` | 0, 0 |
| typecheck | rpc typing / wallclock | `npm run check:rpc-typing`, `check:wallclock-brand` | 0, 0 |
| unit-tests | dancer isolation | `npm run check:dancer-area-isolation` | 0 |
| unit-tests | unit | `npm run test:unit` | 1: 16 failures in 5 files that fail identically on clean main (eventViewCompat / occurrenceProgram / publicEventPageLineup contract tests need the live DB, integrityCouldNotRun needs the exec bit, account.today 1 pre-existing). `src/modules/organiser` 3443 passed. |
| perf-budget | bundle budget / requests | `npm run check:bundle-budget`, `check:first-load-requests` | 0, 0 |
| (pre-ship) | build / typecheck ratchet / scoped eslint | `npm run pre-ship` | build PASS, typecheck 99 < baseline 106, eslint 29 files 0 errors; FAIL only on the unit + integrity items above |
| e2e-smoke | browser gate | `npm run test:e2e` | 1: 157 passed, 1 failed (`dancer-home.spec.ts:168` gate redirect); that spec passes alone on this branch and on main (load flake) |
| phone-qa / live-qa / db-contract / prod-smoke | preview, prod keys | n/a | NOT RUN: need a Vercel preview or prod secrets (VERCEL_TOKEN not used) |

## Real data (read-only prod survey, counts only)
9 owner/manager seats on 8 pages; of those pages 2 have no logo, 6 no founded year, 1 no category, 4 no contact phone, so the organiser part of the wizard will show for most. Every stored `organisation_category` is one of the 5 options (2 null); every `dance_role` is one of the 3 values; every non-null `nationality` is a 2-letter code (what the nationality step writes); max 3 languages. `my_profile_progress_v1` is not on prod: the wizard was walked with the fake at the RPC boundary.

## Screens
`docs/people-arc/screens/A-WEB1b/` at 390x844 and 360x640 (40 PNG): every step kind (list required/typed, choice, city pick, dancer photo, organiser logo, year, optional empty/typed), save error, loading, milestone, 100%, partial end, Home button Starter/Ready, My page line, Team toggle on/off/no profile. Measured in each: no control under 44 px, no horizontal scroll. Rendered in a temporary harness (not committed). frontend-design skill: not available in this sandbox's skill list (not loaded); the existing theme tokens and `ui/**` primitives were used, no new palette or fonts.

## Verified / Not verified
- Verified: the rules above in tests; budgets; build; phone sizes in a real browser with fakes; prod data shapes.
- **Not verified**: against real `my_profile_progress_v1`, `organiser_team_set_public_v1` (not on any DB yet); a real dancer photo round-trip through `/app/me/photo?return=`; a real logo upload; Ricky's phone.

## Next steps
1. Merge with A-WEB1a: both carry the identical pinned file and the identical `noHandBuiltLinks` KNOWN entry.
2. A-WEB1a / switcher owner: link Go live's profile row and the switcher to `PROFILE_WIZARD_PATH`.
3. Release B: register teacher/DJ step components in `wizard/registry.tsx` (B-WEB1's `makeRoleWizardSteps` + `submitRoleWizardStep`).
