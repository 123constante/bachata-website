# Handover: editor v2 slice 17k (End the event Undo, wire the before-state)

Branch claude/editor-v2-s1c. Flag organiserEditorV2 stays OFF. No migrations, no admin change, no PR.

## Done
- `EveryBody.tsx` endDo, `series.end_run` branch only: before is now `[{ to: lifecycle ?? 'live', resume: true }]`, so Undo is `series.resume_run {}`. The later-last-date `series.set_recurrence` branch is unchanged.
- `OneOffBody.tsx`: comment line only; before stays `{to}`, Undo is `series.set_lifecycle` back.
- G3 B-N8: raw U+2014 in EveryBody.tsx (Where fact fallback) replaced with the `—` escape. No rendered change.
- New `__tests__/slice17k.test.tsx` (6 tests). Run against the 17j head (EveryBody reverted), the 2 Every tests fail; the rest pass.

## Tap table
| button | destination | prototype/OLD |
|---|---|---|
| End the event (Every, no date) | series.end_run, Undo = series.resume_run | prototype |
| End the event (one-off) | series.end_run, Undo = set_lifecycle back (live or paused) | prototype |
| Undo on "Event ended" | toast Undo runs the inverse plan | prototype |
| Make it live again | series.set_lifecycle live (unchanged) | prototype |

## UNBUILT
- A refused Undo (`invalid_state`, `no_saved_rule`, anything) uses the existing failed-Undo path in saveNow.ts: it shows UNDO_FAILED_TEXT "Couldn't undo. Reload and try again." No new copy added. No case has no readable line.
- The toast-Undo test builds its before by hand, so it also passes on 17j; the two Every wiring tests are the ones that fail there.

## Verified / Not verified
Verified: `npx vitest run src/modules/organiser/p3/v2` 36 files, 422 tests pass; `npm run check:mojibake` clean; tsc -p tsconfig.app.json: 0 errors in EveryBody, OneOffBody, slice17k.test.
Not verified: `series.resume_run` was NOT exercised against prod (no writes, SELECT-only rules); no browser walk at 390x844 (flag OFF, no visual change); full repo tsc baseline not diffed; G3 B-N8 matrix not run separately.
