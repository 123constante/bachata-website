# Handover: organiser R4 slice (c), door Undo

Brief: `docs/briefs/organiser-r4-door-undo.md` on `brief/feat/organiser-r4-door-undo` (sha 5d8093a).
Branch: `feat/organiser-r4-door-undo`. Flag: `organiserR4` look (Undo also shows on the old look, since the door component is shared).

## Done
- `data.ts` `undoCheckIn()` calls `ticket_undo_check_in_v1` untyped (types.ts not touched), the same way the other door RPCs are called.
- **Signature note:** the brief names the first parameter `p_code_or_ticket_id`. The LIVE prod function (read from `pg_proc`, read-only) is
  `ticket_undo_check_in_v1(p_ticket_id uuid, p_event_series_id uuid DEFAULT NULL, p_occurrence_id uuid DEFAULT NULL)`. The code sends `p_ticket_id`.
  The admin migration file could not be fetched (admin repo not reachable with plain git from this sandbox).
- `model.ts`: one mapping, `undoKindOf` (result + undone) and `undoText`: undone / already undone / night ended ("This night has ended, so it cannot be undone") / not allowed / refused (any other refusal) / error with Try again.
- `DoorScreen.tsx`: after a Search-tab tick that lets someone in, the bar at the foot shows "<name> is in. N of M in." with **Undo** (44px, #C2410C) and OK. While it runs: "Undoing..." and disabled, guarded by a ref, so a double tap sends one call. Ticks are blocked while Undo runs. After undone or already undone, the counter is set from the reply and the list is fetched again. Footer copy changed from "A tick cannot be undone here." to "Tapped the wrong name? Tap Undo straight after."
- Seat-only door (SeatDoorPage `seatOnly`) uses the same component, so it gets the same bar. Covered in the matrix.
- Tests: `__tests__/door.undo.matrix.test.tsx` (every result x R4 / R4 seat-only / old look, retry, double tap, counts, no Undo after a typed code). Walk: `tests/e2e/walk-r4-door-undo.spec.ts` (manual, listed in MANUAL).
- Guard lists: `ticket_undo_check_in_v1` added to `not_event_writes` in `scripts/onboarding-write-doors.json`; the walk spec added to MANUAL in `check-e2e-spec-coverage.mjs`.

## Left / gap (needs owner or backend)
- **Undo after a SCAN or a typed code is not possible yet:** the v3 check-in replies (`ticket_check_in_v3`, `_by_code_v3`) carry no `ticket_id` (checked on prod: none of the bodies has the key). Undo only shows after a list tick, which knows the ticket id. Next step: the admin repo adds `ticket_id` to the check-in reply (or the undo RPC accepts the QR token or short code). Then set `ticketId` in `run()` from `c.ticket_id`.
- An already-in row on the list has no Undo (only the latest tick does). Boards 16-17 were not available to this cloud worker; the look follows the existing R4 door toast.

## Next steps
Owner phone test on a preview with `VITE_ENABLE_ORGANISER_R4=true` and `VITE_ENABLE_TICKET_DOOR_CODE=true`.
