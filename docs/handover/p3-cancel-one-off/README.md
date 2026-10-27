# Handover: P3 W2c "Cancel the event" on a one-off

Branch `claude/p3-cancel-one-off`. Brief: `brief/p3-cancel-one-off:docs/briefs/p3-cancel-one-off.md`.
Lane normal: no DB change, no SQL. Every P3 surface stays behind `organiserP3`.

## Done
- `shared/seriesCommands.ts`: `series.cancel_one_off` in `OWNER_COMMAND_KINDS`,
  `OWNER_CANCEL_ONE_OFF_KEYS = ['reason']`, `cancelOneOffCommand(reason)`.
- `shared/selfServeErrors.ts`: `COMMAND_COPY` rows for `cancel_one_off_started`, `_past`,
  `_not_live`, `_not_one_off` / `_festival` / `_dates` (one plain fallback), the reason
  refusals (`invalid_payload: cancel_one_off_reason` and the dispatcher's `permission_denied`
  payload rule). Server texts read from prod `_cmd_series_cancel_one_off_p5` and
  `check_owner_command_allowlist_v1` (read-only, 2026-10-26).
- `p3/model/cancel.ts`: `canCancelOneOff(input, today, now)`, THE enable rule, mirroring the
  server (materialised start vs now on a date today; no start today = started). Greyed reasons
  in `CANCEL_WHY`; it never hides the row on a live or hidden one-off.
- `p3/data/eventPage.ts`: the Status sheet's `cancel` row is enabled by the rule; End it on a
  one-off that can still be cancelled says "Cancel the event instead"; the old placeholder
  (`STATUS_COPY.cancelWhy`) is gone. `cancelPlan`, `cancelEventCommand`, `bringBackStep`,
  `CANCEL_COPY`.
- `p3/screens/CancelEventSheet.tsx` (C3 `cancelnext`, one-off wording) and `p3/screens/Sheet.tsx`
  (the sheet frame, moved out of StatusSheet). `StatusSheet` gains the `cancel` step;
  `EventPage` wires `useSendOnce` and the toast's "Bring it back".
- `shared/runCommands.ts`: `useSendOnce(seriesId)`: one series command under a key the caller
  keeps, returning the server answer (`data.already_cancelled`, `data.reason`).
- Tests: `cancelOneOff.matrix.test.tsx` (68), `cancelOneOff.send.test.tsx` (real envelope),
  the two mirrors (`parity-matrix.test.ts`, `seriesCommands.test.ts`), `eventPage.matrix.test.tsx`.
- Screenshots (390x844, light + dark): this folder. `status-<shape>-<scheme>.png` for every
  shape, `cancel-*` for the sheet, the refusal, and both toasts.

## Not done / left
- No date sheet exists on the P3 event page yet (W2a lists Coming up rows without a sheet), so
  there is no "Cancel this date" control to point at the same sheet. When W2b builds the date
  sheet, a one-off's date control must open `CancelEventSheet` and send `cancelEventCommand`.
- `consistency.render.matrix.test.tsx` pins no command kinds, so it needed no change.
- "Already cancelled: Bring it back" from the Status sheet: the row is greyed and points at the
  current organiser area, because P3 has no date control to put a date back from yet.

## Next steps
1. W2b date sheet: reuse `CancelEventSheet` for a one-off's date (one control, one mapping).
2. Owner phone test on a real live one-off (prod has exactly 1 with its date ahead).
