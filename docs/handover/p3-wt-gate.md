# Handover: p3-wt-gate (GATE-RETRY, F-10 / F-11 / F-12 / F-15)

Branch `claude/p3-wt-gate`, brief `brief/p3-wt-gate:docs/briefs/p3-wt-gate.md`. Gate flag `organiser_onboarding_gate`
stays OFF (prod `gate_on=false`, read 2026-11-01). No server, admin, `GraceBanner`, `EditTray.tsx` or routing change.

## Data source (proved first, read-only prod, pg_proc)

- `_require_onboarding_complete_v1` raises `ERRCODE P0001, MESSAGE 'onboarding_incomplete', DETAIL
  {"missing":[...],"organiser_id":...}::text, HINT 'Finish your details'`. supabase-js returns it as `error`
  (`message` / `details`). Client recognises it with `isOnboardingRefusal` (`/^(permission_denied: )?onboarding_incomplete/`
  on `message`) and reads the facts with `refusalFacts` (`details` JSON). Unchanged, ONE mapping: `useGatedCopy` / `gatedCopy`.
- `ticket_type_upsert_v1`: gate line in the create branch (`IF v_id IS NULL`), AFTER its only `EXCEPTION WHEN others`
  block closes, so the refusal propagates as an error (not `{ok:false}`). `ticket_type_set_status_v1`: gate only for
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
gate, discard refusal) and model.matrix (order). Ran the new tests against unfixed main: all 11 refused rows red,
off/passed rows green.

## Left / next steps

1. CI parity not run locally: `npm run lint` chain, `npm run build` + `check:bundle-budget` (main vs branch, /app first
   load must be +0 bytes; RepeatSheet now imports `gateRule` -> `statusQuery`, both tiny and in the event-page chunk),
   e2e smoke + p3, the 390x844 overlay e2e (sheet/confirm/toast inside the viewport, no page scroll on open).
2. `check-onboarding-write-doors.mjs --live` not run (needs VITE creds); live gated=10 >= config 8, so it should pass.
3. Not in scope, noted: `admin_bulk_occurrence_command_p5` is gated live but still `expected_pending` (A-gate-11).
4. Independent review (one round) + one fix round, then the orchestrator walk, per the brief's stopping rule.
5. Browser walk with the flag ON needs a branch DB (never prod).
