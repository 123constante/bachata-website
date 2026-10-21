# A-WEB1a handover: Go live reads the one server list + the C14 edit lock (Website)

Branch `claude/people-a-web1a-golive` from `origin/main` (9d283c57, carries organiser R1 #809). Ticket dt_6ea2346051f1.
No PR opened (COMMON). Frontend-design skill: **not available in this cloud session** (not in the skill list); the
screens reuse the existing `ui/**` primitives and `theme.css` tokens only (no new palette, font or primitive).

## What I built

| File | What |
|---|---|
| `src/modules/organiser/shared/profileProgress.ts` | PINNED (D48), byte-identical to the brief block (md5 `184ff6724371cbfa53f4b2b5c51c3178`, LF in the index). A-DB1's `my_profile_progress_v1` keys (`percent, required_left, publish_ready, steps, declined`) match the pin: no STOP. |
| `src/modules/organiser/shared/goLiveCheck.ts` (new) | `series_go_live_check_v1` boundary (`UntypedRpc`, string name) + `parseGoLiveCheck(raw): GoLiveCheck` (throws `go_live_bad_shape`), `fetchGoLiveCheck`, `useGoLiveCheck(seriesId, enabled)`, `goLiveCheckQueryKey`; THE label map `GO_LIVE_LABEL` (D49 words, identical to admin `lib/goLiveCheck.ts` on `claude/people-release-a-admin`, incl. the D55 codes `name`/`country`/`organiser`), `goLiveLabel(code)` (unknown code -> "Something else on the event", never the code), `RECOMMENDED_WORD`; `goLiveFixHref(section, seriesId)` (section -> organiser-area screen with `returnTo` = this event; unknown section -> null, no link); `profileRowLabel(n)` "Complete your profile (N left)"; `goLiveRefusal(error)` parses the A-DB1 refusal (`... needs a ready series: <json>`, JSON in PostgREST `details`, falling back to the message). |
| `src/modules/organiser/events/lifecycleModel.ts` | Pure layout of the server answer: `goLiveList(check, seriesId, linked)`, `firstFix(list)`, `goLiveState(check, seriesId, lock, a1)` -> `locked` / `a1` / `send` / `fix{to}`; `lifecycleRows(ws)` keeps only which rows a status shows. |
| `src/modules/organiser/events/LifecycleActions.tsx` | Go live is ONE tap: server ready -> sends `series.set_lifecycle live`; not ready -> jumps to the FIRST missing item's screen; the server list renders under it in server order (blocking items, the one profile row, then "Recommended" items). Check loading/failed -> the tap sends and the server decides; a readable refusal renders the same list + "Not ready to go live yet." (never the generic error). Locked -> Go live off with the reason + "Complete your profile" link; the event items show without links. |
| `src/modules/organiser/events/ProfileLock.tsx` (new) | `useEventLock(ws)` (progress of the event's FIRST linked organiser + `useIsAdmin`; `profileLock` from the pin), `useSeriesLock(seriesId)`, `LockNote` (reason + link to `PROFILE_WIZARD_PATH?returnTo=<event>`), `LockedRow` (aria-disabled, Tab-reachable, `aria-describedby` -> reason), `LockedScreen`, `SeriesLockGate` (a locked flow URL shows the reason instead of the screen). |
| `events/OneEvent.tsx` | Lock on Pause / End / Change the day / Stop repeating / Make it weekly, Add a date (empty state + the NO_COMING way out), each date's Sessions (line-up), Go live; a locked `?do=` step URL shows the reason. Resume, Discard, change/cancel one date, Put it back stay open. |
| `events/Details.tsx` | Lock: every detail row, Programme, Organisers, Flyer, Gallery, Videos render read-only with `aria-describedby` -> one reason + link at the top of the card; a locked `?edit=` URL shows the rows, not the edit screen. |
| `events/ProgrammeSeries.tsx`, `flows/add/AddFlow.tsx` (day/time steps), `flows/fix/CoverFlow.tsx`, `dates/index.tsx` (date line-up) | Wrapped in `SeriesLockGate` (disabled-with-reason only). |

### Deleted (the client copy of the rule)
`goLiveMissing()`, `goLiveReason()`, `MISSING_DATE`, the `toDetails` / `toAddDate` row flags and the "Open Details" /
"Add a date" links of the lifecycle card. That rule let a weekly event with one dated session go live (it checked name,
venue, a coming date and a cover; never a session nor a description). The server's list replaces it.

### Tests changed outside the new file
- `__tests__/fpar.review.test.tsx` section 1: the GO_CASES of the deleted client rule replaced by pure `goLiveState` cases (A1 gate over the server answer, the lock wins).
- `__tests__/pseries.parity.test.tsx`: the draft card's A1 reason is now "Needs the next platform update." (the list is the server's; covered in the new file).
- `dates/__tests__/DatePage.test.tsx` walk 7c: the lock gate now observes the event workspace, so an invalidation refetches at once; the assertion accepts "stale OR re-read" (still red when nothing invalidates: count stays 1).
- `shell/__tests__/noHandBuiltLinks.test.ts`: KNOWN gains `shared/profileProgress.ts` (the PINNED file spells `/account/o/complete`). **A-WEB1b hits the same test**: the orchestrator should make both branches carry the identical KNOWN entry, or move `PROFILE_WIZARD_PATH` into `ORG_PATHS` when it next touches the pin.

## Red first
New file `src/modules/organiser/events/__tests__/goLive.webA1a.test.tsx` (35 tests). Run against main's code (every
changed source file stashed; only the new, unwired `goLiveCheck.ts` kept so the file resolves):
`Tests 25 failed | 10 passed (35)` -- every behaviour test red (the six codes x {list, refusal}, the map mutation, the
weekly/`session` case: `Unable to find an element by: [data-testid="org-life-list-head"]` because main showed its own
"ready" reason, recommended, profile row, every lock case). The 10 that pass on main are invariants main already
holds: cancel / change-time send their one command, an admin is not locked, loading/error/bad-shape of either RPC
never locks and Go live still sends. After: `35 passed`. Organiser + admin-organisers suites: `Test Files 122 passed,
Tests 3509 passed | 2 skipped`.

## CI (run locally; GitHub Actions not used)
| job | step | command | exit |
|---|---|---|---|
| typecheck | RPC typing guard | `npm run check:rpc-typing` | 0 |
| typecheck | WallClock/Instant brand gate | `npm run check:wallclock-brand` | 0 |
| typecheck | typecheck | `npm run typecheck` | 2: 99 errors, the SAME 99 on main (`git stash -u`, same count); none in a file this slice touches |
| architecture-guard | integrity guard | `bash bin/check-integrity.sh` | 0 |
| architecture-guard | legacy tables / legacy program RPCs | `npm run check:legacy-tables`, `check:legacy-program-rpcs` | 0 / 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 (first run 1: `organiser_id` in the new boundary parser + its spec; both added to the rule's `allowFiles` with a comment, like `selfServeApi.ts`. **`scripts/lint-runtime-architecture.mjs` is outside my file list**: say if you want it another way) |
| architecture-guard | image audit | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | plan hygiene / mojibake canaries | `check:plan-hygiene:self-test`, `check:mojibake:self-test` | 0 / 0 |
| unit-tests | dancer-area isolation | `npm run check:dancer-area-isolation` | 0 |
| (lint chain) | all links | `npm run lint` | 0: 20 of 20 green (after `chmod +x bin/*.sh` as CI does; without it check:integrity exits 126) |
| unit-tests | unit + contract suite | `npm run test:unit` | 1: 15 failed / 10166 passed in 4 files (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` contract suites need a live DB; `integrityCouldNotRun`). The SAME 4 files fail the same 15 on main. 0 failures in the organiser module |
| perf-budget | build | `npm run build` | 0 |
| perf-budget | bundle budget / first-load requests / chunk cycles | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 / 0 / 0 |
| phone-qa | phone suite 390x844 + 360x640 | `npx playwright test --config playwright.phone.config.ts` | NOT RUN in full (only my temporary screenshot spec, 7 passed) |
| phone-qa | build smoke | `playwright.build.config.ts` | NOT RUN |
| e2e-smoke, perf lighthouse, db-contract-check, live-qa | | | NOT RUN: need a live deploy, prod keys or a DB |

## Screenshots (390x844, `docs/people-arc/screens/A-WEB1a/`)
Taken with a temporary Playwright spec on the phone suite's fake Supabase (both new RPCs, the home read and the
workspace faked; `A1_APPLIED` flipped to true only for that run so Go live can send; neither committed):
`ready.png` (ready + recommended ticket link), `not-ready.png` (session + flyer missing, profile row, recommended),
`refusal.png` (check unavailable, tap -> server refusal list + "Not ready to go live yet."), `locked-draft.png`,
`locked-event.png` (Pause/End/Change the day/Stop repeating and Sessions off with the reason), `locked-details.png`,
`unlocked-event.png`. The draft's "1 more / No coming dates" is the fixture's home read (no next date for the draft), not this slice.

## Decisions I made
1. **Which organiser drives the lock**: the event's FIRST linked organiser (`ws.organiserIds[0]`). A co-hosted event
   whose caller sits only on the second page reads the first page's progress. Say if it should be "the page I hold a
   seat on" (needs the home read's organiser list).
2. **A1 gate kept**: `A1_APPLIED` is still false on main, so Go live stays off with "Needs the next platform update."
   (or the ready sentence when the server says ready); the server list still shows under it with its links.
3. **Resume stays open** while locked (C3: a resume is not a go-live; the brief's lock list does not name it). Discard
   and Put it back stay open too (not in the list).
4. **Unknown codes/sections** (a code added after this map): plain "Something else on the event", no link; the tap then
   sends and the server's refusal shows the list.
5. **Locked Go live hides the item links and the profile row**: the lock's own "Complete your profile" link is the way
   out; links to locked screens would point at controls that cannot work.
6. **Every fix link carries `returnTo=<this event>`** (D37). Details / Programme / Add a date / Flyer do not read it yet
   (they already come back to the event); the wizard (A-WEB1b) is the reader that matters.

## Not verified
- Against a real database: `series_go_live_check_v1` and `my_profile_progress_v1` are not on prod; both are faked at
  the boundary (tests and screenshots). No prod shape survey beyond the A-DB1 handover's contract.
- 360x640 screenshots and the full phone suite (`playwright.phone.config.ts`): only the temporary screenshot spec ran.
- Real-device tap test; GitHub Actions on the pushed head; the Vercel preview.
- Home "Needs a flyer" job links into the (now gated) flyer screen: the gate says why, but the Home row itself is not
  locked (`jobs/homeJobs.ts` is A-WEB1b's).

## Next steps
- Orchestrator: reconcile the `noHandBuiltLinks` KNOWN entry with A-WEB1b (see above).
- Flip `A1_APPLIED` in the merge train as planned; Go live then sends or jumps per the server list.
