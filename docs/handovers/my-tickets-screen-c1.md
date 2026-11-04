# my-tickets-screen-c1 (review nits N1, N2 on PR #1334)

## What changed
- `myTicketsModel.ts`: `QR_OPEN_DEFAULT = 3` and pure `qrOpenByDefault(upcoming, todayKey)` (today's tickets first, then server order, first 3; past never; null date counts as upcoming).
- `MyTicketsPage.tsx`: `TicketCard` takes `defaultOpen` (from `openSet`, computed once with `useMemo`; false for past). Collapsed cards use the existing "Show QR code" button. No new copy.
- Matrix test: new rows `40 upcoming tickets` and `past + checked in`; model table for `qrOpenByDefault`.

## Tests, red then green
- Red against unfixed code: 9 new tests failed (`40 upcoming tickets` + 8 model rows). `past + checked in` passed at once: it pins existing behaviour (N2).
- Green: `npx vitest run src/modules/tickets` 411/411 (10 files).

## Checks
| Check | Result |
|---|---|
| vitest src/modules/tickets | pass, 411 |
| tsc --noEmit | pass |
| check:mojibake | pass |
| eslint src/modules/tickets | 1 error, pre-existing (`setResult(null)` in effect, line unchanged by this work) |

Note: `qrcode-generator` was missing from node_modules in the worker; installed with `--no-save` (package.json untouched).

## Verified / Not verified
Verified: the tests and checks above.
Not verified: no browser walk (390x844 / 320x568) was done; the orchestrator walks it. Full `pre-ship` and the other CI jobs were not run.
