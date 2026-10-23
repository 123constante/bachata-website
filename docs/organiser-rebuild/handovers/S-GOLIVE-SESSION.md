# S-GOLIVE-SESSION handover

## Done
- `events/lifecycleModel.ts`: `hasUpcomingSession(ws, today)` (series programme session on any upcoming listed date, or a session added to one; past and cancelled dates do not count), `NO_SESSION_REASON = 'Add at least one session first.'`, `MISSING_SESSION`. `goLiveMissing` adds the session LAST (and not while a date is missing: a session sits on a date). `goLiveReason` appends the sentence; `lifecycleRows.goLive.toProgramme` drives a new "Add a session" link to `ORG_PATHS.eventProgramme` on the card.
- `flows/new/model.ts`: `finishReason(hasCover, draft, today)` = cover reason, then the SAME `hasUpcomingSession`; `NO_SESSION_NEW_REASON` = "Add at least one session first. Save as draft, then add a session from the event." Loading state is off with `CHECKING_REASON`. `NewFlow.tsx` uses it for the button reason and guards `goLive()`. "Save as draft and leave" stays offered (A1 on), so the empty state has a way out.
- Brief premise gap: `reviewModel.ts` / Send for review no longer exist on main (removed in S5), so there was no second copy to merge; `NO_SESSION_REASON` and the rule now live once in `lifecycleModel.ts`, and the New flow imports them.
- A1 wording: `GO_LIVE_READY` still correct (only shown when A1 off AND nothing missing, session included).
- Tests: new `events/__tests__/goLiveSession.matrix.test.ts` (prod-shaped: zz test one_off 0 sessions, weekly with programme session, added future session, added past-only, added cancelled-only, all cancelled, session+no cover, session+no date) on BOTH screens. `fpar.review.test.tsx` fixtures now carry a programme session (they isolate Details/date items).

## RED first
Against main's source (model changes stashed): `Tests 16 failed | 3 passed (19)` in goLiveSession.matrix.test.ts. After the change: 19 passed.

## CI table (sandbox)
| Job step | Command | Exit |
|---|---|---|
| unit-tests (organiser) | `npx vitest run src/modules/organiser` | 0 (3369 passed, 2 skipped) |
| typecheck | `npm run check:rpc-typing`, `npm run check:wallclock-brand` | 0, 0 |
| architecture-guard | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0, 0, 0 |
| build | `npm run build` | 0 |
| `tsc -p tsconfig.app.json` | pre-existing errors elsewhere (breadcrumbs, +types, two organiser TEST files), none in files touched here | n/a |

Not run: e2e-smoke, perf-budget, types-drift, check:images, bin/check-integrity.sh, the full-repo vitest.

## Verified / Not verified
Verified: pure rule and both screens' reasons by table tests; prod build compiles.
Not verified: 390x844 browser walk / Vercel preview, real phone, live publish. The server still accepts a live event with no session if the app is bypassed (owner accepted). No prod write made; Supabase not queried this run (counts taken from the brief).

## Next steps (if anything fails in CI)
Re-run the table rows above; the rule is in one function, `hasUpcomingSession`.

## Fix pass on R-GOLIVE-SESSION (PASS WITH FIXES)
- F1: new `events/__tests__/goLiveSession.render.test.tsx` renders `LifecycleActions` (zz-test shape: off with `Add at least one session first.`, `org-life-add-session` href = `ORG_PATHS.eventProgramme(id)`; with a session: a pressable button, no link) and the New flow cover step (`org-new-live` off with `NO_SESSION_NEW_REASON`; on with a programme session).
  MUTATION: NewFlow `finishReason` wiring reverted + card `toProgramme` link removed -> 2 of 9 render tests failed (one per screen); both restored, 9 pass.
- N1: unused `coverStepReason` import removed from `NewFlow.tsx`.
- N2: when the session is the only blocker on the last step (`finishReason === NO_SESSION_NEW_REASON`), "Save as draft and leave" goes to `ORG_PATHS.eventProgramme(seriesId)`; otherwise Home. Tested both ways, plus the no-photo case.
- N3: A1-off reason lower-cases the tail after "Before then, " (`... Before then, add at least one session first.`); A1-on text unchanged. Tested both.
- N4: a festival draft with no session shows `Festival days are edited with the platform team for now.` (the programme screen's `FESTIVAL_REASON`) and no "Add a session" link. Tested.
- N5, N6: accepted as is (draft-fetch failure shows the checking reason with the leave link on screen; MISSING_DATE skip when no scheduled occurrence row).

| Command | Exit |
|---|---|
| `npx vitest run src/modules/organiser` | 0 (120 files, 3378 passed, 2 skipped) |
| `npm run build` | 0 |
| `npx eslint` on the 7 touched src/test files | 0 |
| `npm run lint:architecture` | 0 |
| `npm run check:rpc-typing` | 0 |
| `npm run check:wallclock-brand` | 0 |

Not verified (unchanged): browser walk at 390x844, real phone, GitHub check status, e2e-smoke / perf-budget / check:images / full-repo vitest.
