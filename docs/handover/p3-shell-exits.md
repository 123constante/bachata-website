# Handover: p3-shell-exits

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

## Fix round (review r1, `claude/review-1202-r1:docs/review/pr-1202-r1.md`) -- the ONE round

Brief `brief/p3-shell-exits-fix:docs/briefs/p3-shell-exits-fix.md`. Each fix red first; each mutant re-run red.

- **S1** `flows/new/NewFlow.tsx` Cover "Go live" with profile questions left in P3 -> `p3StartReview(selected.id)`
  (P3's Review for the page), not the bare event page. Red on `0abafe2^` (`/account/p3/events/s1`), green now.
- **S2** new `p3/shell/__tests__/P3NewFlow.exits.test.tsx`: Cover profile-left -> Review, no command (M4 red);
  Cover live -> P3 Done, primary "Back to Friday Party" -> event, second "Back to You" (M3, M10 red);
  `returnToSeriesId` table (R1/P3 event + sub-screen, go-live, Events/You/Home/null). `history.matrix`: event-page
  rows Prices/History/Organisers by real href (M12 red).
- **N4** `p3/you/surface.tsx` `P3PushedSurface` loading frame backs to Events (`EVENTS`, also reused by `createHub`);
  tested (mutant red).
- **N3** `More.test.tsx`: R1 More renders h1 "More" and back "Home" -> `ORG_PATHS.home` (M14 red by DOM now).
- Skipped nits: N1 (Change a date lands on a list: product call), N2 (matrix loading-state sweep: covered by the
  new behavioural rows), N5 (no P3 budget row: perf-budgets change, not a one-liner), N6 (assert rendered Help rows),
  M6 tab highlight, M11 error-path back, M15 pre-existing R1 gap.

Shape survey (prod `stsdtacfauprzrdebmzg`, read-only counts, 2026-10-30): organiser memberships 18 owner / 45
manager / 0 contributor (no contributor role exists); 51 member pages: 36 with no owner, 13 with one, 2 with two;
events per page 0: 4, 1: 19, 2-100: 28, max 45, none >100 (one series has >100 dates); pages all `live` (49), no
draft page on prod; series live 69 / draft 13 / ended 21 / paused 2 / archived 653; weekly 52 with rule, 26 without;
6 events with two organisers. Row added: `sw1.parity` "P3: owner|manager of a two-organiser event" (manager sees
the owner-only reason, Link off; Back -> P3 event). The 0-event page, draft-page "cannot start" state and weekly
without rule do not change these screens beyond existing R1 rows.

Local CI steps (fix round): integrity, legacy-tables, legacy-program-rpcs, lint:architecture, `AUDIT_STRICT=1
check:images`, plan-hygiene + mojibake self-tests, rpc-typing, wallclock-brand, dancer-area-isolation (+self-test),
`npm run lint` (24/24 links; eslint informational, errors on touched files pre-existing) -- all green. Unit,
build + bundle budget: see the PR body. Note: `.githooks/*` are not executable in this container, so the
pre-commit/pre-push hooks were skipped by git (not `--no-verify`).

## Left (next worker)

- 390x844 browser walk of every new route (flags organiserP3 + organiserSelfServe on).
- `pre-ship` not run in this round.

## Open questions / judgement calls to review

- P3 Cover "Go live" with profile questions left -> P3 Review for the page (fix round S1; was the event page).
- Help rows change/add/cancel -> P3 Events in P3.
- Done after New event in P3: back = the new event (label falls back to generic if name not loaded).
