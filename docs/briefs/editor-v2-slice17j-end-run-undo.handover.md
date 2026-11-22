# Slice 17j handover: Undo after "End the event", the command and the inverse

Model-only slice: no UI taps. Pure-function cases instead:

| case | result |
|---|---|
| undoPlan([end_run], [{to:'live', resume:true}]) | series.resume_run {} |
| before {to:'live'} / {to:'paused'} | series.set_lifecycle to that state |
| before null / {} | null (no Undo) |

Done: `inverseOf` case `series.end_run` (+ doc bullet); `series.resume_run` in `OWNER_COMMAND_KINDS`; mirror lists in seriesCommands.test.ts and parity-matrix.test.ts; slice17a tests replaced/added. Also updated one stale "no inverse" test in slice17b.test.tsx (not in the brief's file list; it asserted the old behaviour and went red).

## UNBUILT
Slice 17k: EveryBody / OneOffBody must capture the before-state (`resume: true` for weekly, `to` for one-off). Until then no real toast gets an Undo.

## Verified / Not verified
Verified: vitest p3/v2 + shared + parity-matrix 85 files / 1871 tests green; tsc --noEmit 0 errors; check:mojibake clean.
Not verified: resume_run was not exercised against prod (no writes); no browser walk (no UI change).
