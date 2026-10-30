# Scoping: P3 W4c -- organiser-side "Who's going" in the P3 organiser area (read-only docs job)

2026-10-30. Base: `main` @ `a1d0fa6`. Nothing built; no source edits. Prod reads were SELECT-only on
`pg_proc` and counts (project `stsdtacfauprzrdebmzg`), no personal data.

## 1. What "W4c" is, as written

**The label "W4c" appears nowhere.** `grep -rni "w4c"` over `docs/`, `src/`, `.claude/` and every remote
branch name returns nothing. The written W4 waves are W4a (Team / Switch / Organiser page,
`docs/design/p3-w4a.md:1`) and W4b (onboarding, `docs/design/p3-w4b-onboarding.md:3`,
`docs/handovers/p3-w4b2-page.md:1`). There is no `brief/p3-w4c*` branch.

So W4c = organiser-side Going in P3 is taken from the dispatch, and the scope below is what the docs
DO say about organiser Going in P3:

- `docs/organiser-rebuild/p3/CONTRACT.md:139` -- "Going (Home, date, page, Stats) | going RPCs on main
  (`get_my_event_going_v1`, `get_my_organiser_going_total_v1`, ...) | none | Live on main, switch off".
- `CONTRACT.md:446-451` -- "C3's Who's going (Home, date sheet, page, Stats) consumes these as they are.
  P3 mounts `OrganiserGoing.tsx` / `GoingTotalStat.tsx` only when both `organiserP3` and the going switch
  are on. No server gap, no conflict." (Section 6 of this doc shows the "no server gap" claim does not
  hold for the per-event read.)
- `docs/design/going-p3-organiser.md:9-16` -- the agreed slots: Home "Next up" hero, date-strip sheet row
  "Who's going (12)", Stats "By event" row, and the sheet itself.
- `docs/handovers/going-p3-organiser.md:48-54` -- the same three slots "agreed 2026-10-23", with exact
  mount code; `:65-66` "Organiser lane mounts the parts (their PR; no file here changes)" -- **this
  mounting is the work nobody has done yet.**
- `docs/handover/p3-w0-foundation.md:20-21` and `docs/handover/p3-w1-home-events-stats.md:13` -- W0/W1
  mounted only the going TOTAL.

The design source both docs cite, mockup C2 at `claude/er-p3-mock-c2:docs/organiser-rebuild/p3/mockups/C2.html`
(`going-p3-organiser.md:8`), is **not on the remote** (no such branch; no `C2.html`/`C3.html` anywhere in
the tree). Not read.

## 2. What exists today

### Going module (`src/modules/going/`, all merged, switch off)
| Part | File | What |
|---|---|---|
| Switch | `src/lib/goingCheckin.ts:1-20` | ONE switch `GOING_CHECKIN_ENABLED`. OFF on production; ON only on a Vercel preview with `VITE_ENABLE_GOING_PREVIEW=true`. Owner's call to turn on (`:4-5`). |
| Per-event read hook | `useMyEventGoing.ts:44-50` | wraps `get_my_event_going_v1(p_public_event_id)`; off while the switch is off; non-uuid id = `not_found`, no request. |
| Total hook | `useMyOrganiserGoingTotal.ts` | wraps `get_my_organiser_going_total_v1()` (`docs/handover/going-stats-total-web.md:16`). |
| Components | `OrganiserGoing.tsx` | `GoingNightSummary`, `GoingPeopleSheet`, `GoingLoadState` -- props and render rules in `docs/handovers/going-p3-organiser.md:42-46`. |
| Total stat | `GoingTotalStat.tsx` | stat-card inside; words in `going-stats-total-web.md:22-31`. |
| RPC names | `goingRpc.ts:25-30` | `set_my_going_v1`, `get_nights_going_v1`, `get_my_going_v1`, `get_public_dancer_extras_v1`, `get_my_event_going_v1`, `get_my_organiser_going_total_v1`. |
| Guard | `scripts/check-going-rpcs.mjs` | anon probes of the six RPCs; still not a step in `db-contract-check.yml` (`going-p3-organiser.md` handover `:70`). |

### Going data model (from the prod function body, `pg_get_functiondef`, 2026-10-30)
`get_my_event_going_v1(p_public_event_id uuid) returns jsonb`, SECURITY DEFINER:
- `not_signed_in` (42501) when no user; looks up `event_series_p5 WHERE public_event_id = p_public_event_id`,
  `not_found` (P0002) if none; `not_organiser` (42501) unless `_is_entity_member('series', ..., ['owner','manager'])`.
  **A team Contributor is refused.**
- Returns `{public_event_id, nights:[{occurrence_id, occurrence_date, starts_at_local, is_cancelled,
  going_count, people[]}]}` for every NOT-ended night of the series (cancelled included), ordered by start,
  up to 200 people per night via `_going_nights_v1`. Client type: handover `:37-38`.

`get_my_organiser_going_total_v1()`: `{going_total, nights, events}` over the caller's upcoming,
not-cancelled nights, owner/manager seats only.

### What an organiser sees in P3 now
- Home: `<GoingTile />` (`src/modules/organiser/p3/screens/HomeScreen.tsx:151`) and Stats: `<GoingTile />`
  (`StatsScreen.tsx:82`). `GoingTile` = `GoingTotalStat` from the total hook (`screens/parts.tsx:84-96`),
  returns null while the switch is off. **With the switch off (prod), an organiser sees nothing.**
- No per-night count, no list, no sheet. `useMyEventGoing` / `GoingNightSummary` / `GoingPeopleSheet` have
  **no importer outside `src/modules/going`** (grep).
- Labels exist and are unused: `L.going: 'going'` and `L.whosGoing: 'Who’s going'`
  (`src/modules/organiser/p3/model/labels.ts:92,110`; only a test reads `whosGoing`).

## 3. Missing against the P3 design
1. Home "Next up" hero count + sheet (`going-p3-organiser.md:13`). Hero is `HomeScreen.tsx:91`.
2. Date sheet "Who's going (N)" row + sheet (`:14`, `:16`). One-date sheet is `DateSheet.tsx:146` (`OneDateSheet`, holds `d.id` = occurrence id, `seriesModel.ts:47-56`).
3. Stats "By event" count beside views (`:15`). Section at `StatsScreen.tsx:123-124`.
4. Event page "Who's going" (CONTRACT `:139` and `:449` say "page"; no row spec in the design record). Page is `EventPage.tsx` (`Coming` list at `:94`).
5. **The id bridge** (section 6): P3 holds the series id; the read wants the public event id.
6. Contributor state: what a Contributor sees (refused by the server).

## 4. Screen list, size, data reads
| # | Screen / slot | Parts used | Reads | Size |
|---|---|---|---|---|
| G0 | id bridge (data only) | -- | the public event id per series (section 6) | S Website if a server field lands; else blocked |
| G1 | Home Next up hero: count line + opens sheet | `GoingNightSummary` (+`onOpen`), `GoingPeopleSheet` in P3 `Sheet.tsx`, `GoingLoadState` | `get_my_event_going_v1` for the hero's event | S |
| G2 | Date sheet: "Who's going (N)" row + people sheet | same | `get_my_event_going_v1`, matched by `occurrence_id` = `WorkspaceDate.id` | M (nested sheet over a sheet; past/cancelled dates) |
| G3 | Stats By event: count under views | `GoingNightSummary` (no `onOpen`, or with it) | `get_my_event_going_v1` once PER event row (N calls) | M (N requests; which night a per-EVENT row shows is undefined, see Q3) |
| G4 | Event page: Who's going row / list of upcoming nights | same | `get_my_event_going_v1` | M (no design yet) |
| G5 | Total tile (Home, Stats) | `GoingTotalStat` | `get_my_organiser_going_total_v1` | done (W1) |

Every read exists on prod (pg_proc, 2026-10-30): `get_my_event_going_v1(p_public_event_id uuid)`,
`get_my_organiser_going_total_v1()`, `get_nights_going_v1(uuid[], int)`, `_going_nights_v1`,
`_going_night_ended_v1`. Also on prod, NOT used by Going: `get_my_occurrence_attendance_p5_v1`,
`get_event_attendance_counts*`, `get_festival_attendance*`, `set_attendance` (older attendance family).
None of `organiser_home_v1`, `admin_event_workspace_p5`, `organiser_series_stats_v1`, `event_view_p5`
mentions `public_event_id` in its body (pg_get_functiondef ILIKE, 2026-10-30).

## 5. Database work vs Website-only
- **Website-only:** G1-G4 mounting, the shared "which night" mapping, sheet stacking, the Contributor
  empty state, tests, the 390x844 walk. Everything renders nothing until the going switch is on.
- **Database work (admin repo, not here):** the id bridge, unless the Website can read
  `event_series_p5.public_event_id` itself (RLS not checked). Options: (a) add `public_event_id` to
  `organiser_home_v1` / `admin_event_workspace_p5` / `organiser_series_stats_v1` rows; (b) a
  `get_my_series_going_v1(p_series_id)` twin; (c) a batch read for G3 (one call for all Stats rows).
  Optional: a batch per-event read to avoid G3's N calls.

## 6. The id bridge (a fact the CONTRACT missed)
Prod counts, 2026-10-30: `event_series_p5` has 758 rows, 0 with null `public_event_id`, **638 where
`public_event_id = id`, 120 where it differs**. Of the series with a date today or later, **47 differ and
21 match**. P3 rows carry only the series id (`P3Row.id`, `data/home.ts:24-25`; `WorkspaceSeries.id`,
`shared/seriesModel.ts:17-20`), and no organiser file reads `public_event_id` (grep). Passing the series id
would answer `not_found` for most live events. CONTRACT `:450` "No server gap" is therefore not true for
the per-event read. (The total read takes no id and is unaffected.)

## 7. Collisions with open work
| Open work | Files outside docs/ (vs `main`) | Touches a W4c file? |
|---|---|---|
| #1162 `claude/p3-f4-label-fix` | `src/lib/accountRouting.ts`, its test, `perf-budgets.json` | no; `perf-budgets.json` is shared (G1-G4 add bytes) |
| #1163 `claude/login-auth-default-signin` | `src/pages/Auth.tsx`, `src/lib/focusMode.ts`, tests | no |
| #1164 `claude/login-invite-welcome` | `src/modules/admin-organisers/join/*` | no |
| #1165 `claude/tickets-retire-old-screens` | `src/lib/featureFlags.ts`, `AnimatedRoutes.tsx`, `catchallClientPaths.ts`, `organiser/tickets/*`, `organiser/p3/tickets/*` | no file overlap; `HomeScreen.tsx:152` renders `TicketsSoldTile` beside `GoingTile` (adjacent, not edited by #1165) |
| `claude/ticket-thanks-confirm` | `src/modules/tickets/*`, `tests/e2e/ticket-thanks.spec.ts` | no |
| `claude/ticket-qr-door-screen`, `-fee-zero-web`, `-preview-origin` | -- | already squash-merged (#1141, #1135, #1078); their `EventPage.tsx` / `P3Routes.tsx` edits are on main |
| `claude/ticket-promo-codes-web`, `-qr-door-mockups` | docs only | no |

Likely conflict points for a W4c build: `HomeScreen.tsx`, `StatsScreen.tsx`, `DateSheet.tsx`,
`EventPage.tsx`, `labels.ts`, `package.json` `test:e2e` list (every walk spec joins by name), `perf-budgets.json`.

## 8. Proposed build order
1. Owner answers Q1-Q2; admin decides the id bridge (G0) and ships it (DB lane).
2. G0 Website: carry `publicEventId` into P3 rows/workspace (parser + matrix test over the 47/21 split).
3. G2 date sheet (the design's main slot; has an occurrence id already).
4. G1 Home hero (reuses G2's sheet).
5. G4 Event page (after a design pick).
6. G3 Stats By event (after Q3; needs one-call-per-row or a batch read).
One PR for G0+G1+G2 is in proportion (`docs/pr-batching-policy.md`); G3/G4 after their answers.

## 9. Questions only the owner can answer
1. Is "W4c" this work? No doc names it; confirm the scope (slots G1-G4) and whether G4 (Event page) is in.
2. Id bridge: add `public_event_id` to the existing organiser reads (a), a series-id twin RPC (b), or a
   batch read (c)? (Admin-repo migration either way.)
3. Stats "By event" is per EVENT, the read is per NIGHT: show the next night's count, the sum over upcoming
   nights, or nothing?
4. Contributors are refused by the server: hide the row, or show "Only owners and managers see who's going"?
5. Past dates in the date sheet: the read returns only not-ended nights -- show nothing, or "This date has
   passed"?
6. When does the going switch turn on for organisers -- same moment as the public switch, or separately?
   (Today one switch covers both, `goingCheckin.ts:1-5`.)

## Not found
- Any doc, brief or branch named W4c / w4c.
- Mockup C2/C3 HTML (`claude/er-p3-mock-c2` does not exist on the remote).
- `docs/organiser-rebuild/ARC.md` has no Going/W4 content relevant here (grep).
- `docs/design/p3-wt-ticketing.md`, `docs/handovers/p3-golive-wiring.md`: no organiser-Going content
  (golive-wiring `:31` "Going live..." is the button copy, not Going).

## Not verified
- Whether the Website (authenticated organiser) may SELECT `event_series_p5.public_event_id` directly (RLS not read).
- Signed-in answers of `get_my_event_going_v1` (no test organiser account; body read only).
- Live going counts per night (not surveyed; the switch is off on prod).
- Whether `claude/ticket-thanks-confirm` is still open as a PR (no open PR for it in the list read).
- Any browser walk, test run or CI -- docs-only job.
