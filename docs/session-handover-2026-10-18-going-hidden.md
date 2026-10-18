# Handover 2026-10-18: going-hidden (ticket dt_16cc3eec408a)

Branch `claude/going-hidden`, PR #836. Brief: briefs/going-hidden.md on `arc/briefs-dancer-rebuild`.
Full surface list, switch and Verified / Not verified: `docs/handover/going-hidden.md`.

## Done
- `GOING_CHECKIN_ENABLED = false` in `src/lib/goingCheckin.ts` (pinned into `lib-event-rules` in `vite.chunks.ts`, 0 extra first-load chunks).
- Hidden: event RSVP block + placeholder, FestivalHub counts/buttons/lock line, dancer-app Home tile + numbers-strip cells, Nights/MyAttendance how-to copy, public "Going next".
- Table test `tests/client/goingHidden.test.tsx` (red-first). Existing specs that assume Going mock the switch true; SSR, existing-suites pin and `home-nights` e2e fixed.
- Other workers also pushed here: dt_5ea6a8cb40a5 (dancer-area allow-list, specs moved), dt_f672c211cf54 (auth consent fix, 543deba).

## Open (last CI seen on 543deba)
- `unit (Europe/London, full)`: 1 failure, an `openDay(container)` expected 2 assertion (log shows line ~734; spec not identified). Not yet checked whether it is this PR's or already red on main.
- `contract-check`: red, runs live prod contract scripts, failing step not identified; this PR touches no DB code. Needs one re-run.
- `build-smoke`: failed twice on 3f23a75 (auth-consent double `accept_terms_v1`); 543deba is another worker's fix for it, result not seen.
- Never done: 390x844 browser walk and a prod-shape survey (PR body says so).

## Next
1. Read the checks on the current head; for `unit`, find the `openDay` spec, run it on `main` and on this branch.
2. Re-run `contract-check` once.
3. If `build-smoke` is still red on the consent spec after 543deba, test reverting only the chunk pin.
