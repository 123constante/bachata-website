# Handover: p3-wt-gate (GATE-RETRY, F-10 / F-11 / F-12 / F-15)

PR #1250. Branch `claude/p3-wt-gate`, brief `brief/p3-wt-gate:docs/briefs/p3-wt-gate.md`. Gate flag `organiser_onboarding_gate`
stays OFF (prod `gate_on=false`, read 2026-11-01). No server, admin, `GraceBanner`, `EditTray.tsx` or routing change.

## Data source (proved first, read-only prod, pg_proc)

- `_require_onboarding_complete_v1` raises `ERRCODE P0001, MESSAGE 'onboarding_incomplete', DETAIL
  {"missing":[...],"organiser_id":...}::text, HINT 'Finish your details'`. supabase-js returns it as `error`
  (`message` / `details`). Client recognises it with `isOnboardingRefusal` (`/^(permission_denied: )?onboarding_incomplete/`
  on `message`) and reads the facts with `refusalFacts` (`details` JSON). Unchanged, ONE mapping: `useGatedCopy` / `gatedCopy`.
- `ticket_type_upsert_v1`: gate line in BOTH branches (create: `ARRAY[v_org]`; update: `ARRAY[v_type.organiser_id]` after
  the `FOR UPDATE` read; corrected in fix round 1, review r1 F1), AFTER its only `EXCEPTION WHEN others` block closes, so the refusal propagates as an error (not `{ok:false}`). `ticket_type_set_status_v1`: gate only for
  `p_status='on_sale'`. `ticketsApi` throws `error`, so the ticket screens' catches see it.
- `check_organiser_onboarding_gate_v1()` live: gated=10, healthy, 0 violations. Bodies calling `_require_onboarding*`:
  the 6 config doors + admin_bulk_occurrence_command_p5, admin_collapse_series_to_one_off_p5, admin_duplicate_event_p5,
  series_festival_artists_set_v1, ticket_type_upsert_v1, ticket_type_set_status_v1.
- `organiser_onboarding_status_v1` returns `gate_on`, `is_admin`, `organisers[] {id, complete, missing}`.

## Shapes surveyed (counts only)

48 pages with events, 0 with onboarding completed (1 has contact confirmed): every non-admin organiser would be
refused the moment the flag flips. 1 page has ticket types (2, both paused). 758 series: 571 with EMPTY
`organiser_ids` (server targets then fall back to the caller's own pages; the client rule mirrors this), 6 run by 2+ pages.

## Done

- F-10: Organisers was already on the shared sheet (#1236). New event in P3 is `p3/new/CreateFlow` (main's
  `flows/new/NewFlow` is R1-only now; P3 `new/what|name` redirect to CreateFlow), so F-10's create half = F-15.
- F-11: `TypeSheet` create catch and Add-and-sell's on_sale refusal, and `TicketsEntry` row switch, go through
  `useGatedCopy`. Add-and-sell refused says `SELL_HELD` ("Ticket saved as a draft. It can go on sale once your details
  are finished.") and opens the sheet. `scripts/onboarding-write-doors.json`: both ticket doors moved from
  `not_event_writes` to `gated`, `tickets/ticketsApi.ts` added as their wrapper. **Hard-tier path: needs owner Approve at head.**
- F-12: `RepeatSheet` asks the status read (`p3/onboarding/gateRule.ts`, `useGateAnswer`) before any dry run. Predicted
  refusal: no dry run sent (no failed-change audit row), note `p3-repeat-held`, Save enabled, Save opens the sheet and
  sends nothing. Status read failed/unknown: previews as before, but a refused dry run is HELD (no sheet before Save,
  no further dry runs that sheet).
- F-15: create first, then the cover (upload + `series.upsert {name, default_cover_image_url}`); a refused create
  uploads nothing. Refused create opens the shared sheet (own card removed, typing kept). Refused Discard opens the
  sheet and restores the partial card (no "check your connection").

## Tests (red first, proven)

New: `p3/tickets/__tests__/gate.matrix.test.tsx` (create / add-and-sell / switch-to-Selling x gate off / refused /
passed, + a non-gate failure, + untouched edit sends nothing), `p3/onboarding/__tests__/gateRule.matrix.test.ts`
(13 shapes). Rewritten: `gate.fixround` 5 (Repeat x status unknown / refuse / gate off), `p3/new` flow.render (order,
gate, discard refusal) and model.matrix (order). Ran the new tests against unfixed main (re-measured by review r1): 18 red = 7 refused rows + 11 fixed-order rows,
off/passed rows green.

## Continuation session (brief `brief/p3-wt-gate-cont`), 2026-11-01

Done:
- CI parity run locally (table in the PR body): lint chain 24/24 green (after the fix below), build OK, `check:bundle-budget`
  full report byte-identical main vs branch (same chunk hashes; dancer-app 371.9 KB / 47 chunks both), `tsc` clean,
  organiser unit tests 241 files / 8859 pass, `test:e2e` 178 pass / 2 flaky (dancer-app home-nights, header sign-in @1280:
  unrelated) / 8 skipped, `test:e2e:p3` 117 pass / 2 flaky (p3-gate-sheet dark harness mount timeout on a cold dev
  server; 5/5 on a clean rerun), `check-onboarding-write-doors.mjs` (no --live) exit 0, 0 violations.
- CI parity forced fix 1: `lint:architecture` was RED: the new gate files read the refusal's `organiser_id`. Added
  gateRule.ts + 3 specs to the guard's existing P3-GATE allowlist in `scripts/lint-runtime-architecture.mjs`.
- CI parity forced fix 2 (found by the new overlay e2e): the gate sheet drew BEHIND the open Repeat sheet (GateHost sits
  in the P3 frame; the Repeat sheet is portalled to body), so after F-12's "Save opens the sheet" Save looked dead and
  Continue / Not now could not be tapped. Fix: `GateSheet` renders through `OnBody` (moved to `screens/OnBody.tsx`,
  re-exported from RepeatSheet), so it is appended after any open sheet. Red on the unfixed GateSheet (hit-test fails),
  green fixed.
- New `tests/e2e/p3-gate-overlays.spec.ts` (in `test:e2e:p3`): Repeat held note + Save in view, no dry run sent, Save opens
  the gate sheet in view and tappable; Tickets refused Add keeps the ticket sheet, gate sheet in view and tappable, no
  generic error; no page scroll on any open; gate/Repeat focus uses preventScroll.

## Left / next steps

1. Noted, not fixed (out of scope, on main): `p3/tickets/StackSheet.tsx` focuses its h3 without `preventScroll`
   (lines 100, 143). The page-scroll check passes, so it does not move the page today; the overlay spec only pins the
   gate sheet's own focus on the Tickets path.
2. `check-onboarding-write-doors.mjs --live` not run (needs VITE creds).
3. `admin_bulk_occurrence_command_p5` still `expected_pending` (A-gate-11), unchanged.
4. Full `test:unit` (all modules) not run here; organiser module only.
5. Independent review (one round) + one fix round, then the orchestrator walk. Owner Approve at head (hard-tier
   `scripts/onboarding-write-doors.json`).
6. Browser walk with the flag ON needs a branch DB (never prod).

## Fix round 1 (brief `brief/p3-wt-gate-fix`, review `docs/review/pr-1250-r1.md`), 2026-11-01

Merged `origin/main` (39a887d) first, no conflicts. One round, no new scope:
- F1: prose corrected in the PR body, this doc, the doors config `_doc` (prose only; which doors are gated is unchanged)
  and the tickets matrix (comment + describe). New rows: Edit x {gate off, refused, passed} (changed name). The refused
  row passes on the existing code (TypeSheet already routes the error through `gated`); proven non-vacuous by mutation
  (catch without `gated`: Add refused + Edit refused go red).
- F2: `useGateAnswer().recheck` now resolves to the fresh answer; Repeat's held-Save clears `refusal` on `pass`. New
  `gate.fixround` 5 row (status read fails, dry run refused and held, details finished elsewhere, recheck pass, Save
  sends): red before, green after.
- F3: `gateAnswerFrom` picks the first target (organiser_ids order) the person is on. `gateRule.matrix` expectation flipped
  to `a`: red before, green after.
- F4: `Sheet` remembers the focused element on mount and refocuses it on unmount (if connected). Row in
  `gate.fixround` 3: red before, green after.
- F5: `gateRule.matrix.test.ts` labels reworded ("no pages"), its allowlist entry dropped; `lint:architecture` green.
- F6/F7: PR body wording (tsc and red-count).

Left / next: review round 2 (fixes are unreviewed code); owner Approve at head for the hard-tier doors config.
