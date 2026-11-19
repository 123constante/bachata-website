# Review: PR #1804 (R4 door Undo)

head f336b66f34971ec20536b8bb7421f41f40a37c1d

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Read-only review of `feat/organiser-r4-door-undo`. Admin PR #2007 body and `docs/briefs/organiser-r4-backend-handover.md` were not reachable from this sandbox; the contract was checked against live prod `pg_proc` instead (read-only SELECT).

1. **Right RPC, right args, no table write: PASS.** `data.ts` `undoCheckIn()` calls `ticket_undo_check_in_v1` with `p_ticket_id`, `p_event_series_id`, `p_occurrence_id` (null, server picks the night). Prod signature: `(p_ticket_id uuid, p_event_series_id uuid, p_occurrence_id uuid)`, SECURITY DEFINER, EXECUTE for authenticated only, not anon. No `.from()` write. `scripts/onboarding-write-doors.json` lists it under `not_event_writes`. Tests: 516 passed in `src/modules/organiser/p3/door`.
2. **Results handled, never a false "undone": PASS.** `model.ts` `undoKindOf`: `ok`+`undone===true` is undone; `ok` otherwise is "already undone"; `wrong_night` is ended; `not_allowed`; anything else (including null or empty data) is refused. A thrown error gives `error` with "Try again"; 42501 is treated as signed out. `DoorScreen.tsx` `undoLast` refreshes the list and counts only for undone or already. The retry after a lost reply is safe, since the RPC is idempotent.
3. **Permissions: PASS.** Undo only appears after this session's own successful list tick (`run()` sets it only for `c.result === 'ok'` with a ticket id). There is no client-side role check, so there is nothing widened; the RPC decides who may undo and a refusal is shown.
4. **Double tap and race: PASS.** `undoRef` guards `undoLast`, the button is disabled while running, and ticks are blocked while an Undo runs (and vice versa via `busyRef`). A new tick clears the Undo, and the result is applied only if `ticketId` still matches. The counter is set from the reply, so there is no double count.
5. **Flag and tests: PASS WITH NITS.** `walk-r4-door-undo.spec.ts` is registered in `MANUAL` in `check-e2e-spec-coverage.mjs`. A matrix test covers every result across R4, R4 seat-only and the old look, retry, double tap, counts, and no Undo after a typed code.

## Nits

- Not strictly behind `organiserR4`: Undo and the new footer copy ("Tapped the wrong name? Tap Undo straight after.") also show on the old look when the door-code flag is on. The handover states this. It is additive and safe, but the brief's "flag off keeps old behaviour" is not literally met.
- Undo is missing after a scan or typed code, because the v3 check-in replies carry no `ticket_id`. This is a documented gap that needs an admin change.
- An already-in row has no Undo.

## Not verified

No browser walk was run here, and neither were e2e, tsc or the full CI.
