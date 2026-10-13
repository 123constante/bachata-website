# Brief: Website FIX-4c worker (drop one redundant ref)

Branch `arc/event-truth-p1p3-fix4` (continue it; head dcf6f8cf). Never use `gh api`: read with git. Open NO PR.
Owner decision 2026-10-13: drop the redundant F1 ref. The fix-4 handover section 3 proves `unconfirmedRef` / the `earlierUnconfirmed` input cannot change behaviour (mutants M1d, M1e are equivalent).

Do exactly this, minimal diff:
1. `src/modules/organiser/events/NewEventPage.tsx`: remove `unconfirmedRef` and its `else if (sentRef.current) unconfirmedRef.current = true` branch. The reopen test becomes `reopensAfterFailedCreate({ refused: isServerRefusal(err), firstSend: kept === null })`.
2. `src/modules/organiser/events/newEvent.ts`: `reopensAfterFailedCreate` loses `earlierUnconfirmed` (rule = `refused && firstSend`); update its comment to say why a retry can never reopen (`sentRef` stays set after any unconfirmed send, so a later press has `firstSend === false`).
3. Update tests that pass `earlierUnconfirmed` (the pure-rule table in `createHint.test.ts`, any page test). Keep every F1 page row (a)-(d) as is: they must stay green. Mutant M1b is gone with its input; re-run M1a, M1c and M1f and report them killed.
4. Update handover sections 1 and 3 (say the ref was dropped by owner decision and M1d/M1e/M1b no longer exist). Run `src/modules/organiser` unit tests, typecheck, eslint on changed files, `check:integrity`. Report exit codes. No other file.
5. Commit, push `arc/event-truth-p1p3-fix4` only, report the head SHA.
