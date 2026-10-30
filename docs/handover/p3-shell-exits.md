# Handover: p3-shell-exits (PARTIAL)

Brief: `brief/p3-shell-exits:docs/briefs/p3-shell-exits.md`. Branch `claude/p3-shell-exits`. No DB change.

## Done (all four ordered steps, code + tests)

1. **New event in P3.** `P3_PATHS.newWhat/newWhatFor/newName/newVenue/newDate/newTime/newCover`; `NEW_STEPS` routes in
   `P3Routes.tsx` wrap R1 `flows/new` in `P3PushedSurface` (new, `p3/you/surface.tsx`). `NewFlow.tsx` and `WhichPage.tsx`
   now read `useOrgSurface()` (Shell, paths, new `createHub`: R1 Home, P3 Events). Welcome "Add an event" (D3) follows
   via `paths.newWhatFor`. P3-only: the Cover step's "Almost live" bridge goes to the P3 event page (P3 has no go-live
   screen), and Done gets the event as its back. `returnToSeriesId` also reads `/account/p3/events/:id`.
   `EventConflict` uses `paths.event`.
2. **Account + Help.** `you/account` (R1 More, titled from new `OrgSurface.moreTitle` = "Account") and `you/help`.
   More's back = `hub`, "Add a page" = `addPage`, Hand over / Help / Leave-Done via surface paths. `helpRows(paths)`
   (R1 `HELP_ROWS` unchanged); in P3 change/add/cancel go to P3 Events (they are sheets there). Retargeted
   `YouScreen` Account row, `team/index.tsx` Message us, `GateReason` (Leave links already used `paths.more`).
3. **Co-organisers.** `events/:seriesId/organisers` route + "Organisers" row on `EventPage` (labels `organisers*`);
   `SeriesOrganisers` reads the surface, back = P3 event page in P3.
4. **Links.** `ChangeItLink`/`CHANGE_IT_PATH` removed; `AddEventLink` (P3 new/what) and `P3Link`. Home "Open your
   events", "Sort these in Events", Get paid no-page "Set up your page" (`P3_PATHS.start`).
   `P3Shell.isPushed/tabOf` treat `new/*` and `events/:id/organisers` as pushed (new = Events tab).

Tests: new `p3/shell/__tests__/P3Routes.exits.test.tsx` (route matrix of every new URL: inside p3-shell, one
header/main, Back target, no `/account/o` link; leave mid-create -> Events; Help > Account > You round trip; surface
values; guard: no `ORG_PATHS`/`/account/o` under `p3/**` except surface spread + `acceptedInviteLanding`). Red on main
(suite cannot load), green now. Pins updated: `you.matrix` (more/help -> P3), `screens.matrix` (links -> P3, plus
empty Home/Events Add an event), `goLiveSaveBack.matrix` (SeriesOrganisers back regex).

Local gates run: `vitest src/modules/organiser src/lib` 274 files / 9798 passed; `npm run build` ok;
`npm run check:bundle-budget` all ok (chunk + puller ratchets at allowance). `tsc`: no new errors in touched files
(pre-existing errors elsewhere). Note: `node_modules` lacked `jsqr`; installed `--no-save` locally.

## Left (next worker)

- `/code-review` (one independent round) + one fix round (stopping rule in brief).
- Real-data shape survey (Supabase read-only): 0 / 1 / >100 events, weekly with/without stored rule, draft vs live
  page, manager vs owner; add table rows to the matrix where shapes change screens.
- 390x844 browser walk of every new route (flags organiserP3 + organiserSelfServe on).
- Byte comparison of /app first load vs main (budgets pass; zero-byte claim not measured).
- Run every CI job step locally (`npm run lint`, `pre-ship`, integrity job incl. `check:images` with `AUDIT_STRICT=1`).
- PR body: Verified on real data + Phone QA (390x844). Open the PR if none exists.

## Open questions / judgement calls to review

- P3 Cover "Go live" with profile questions left -> P3 event page (Status sheet) instead of R1 Almost live.
- Help rows change/add/cancel -> P3 Events in P3.
- Done after New event in P3: back = the new event (label falls back to generic if name not loaded).
