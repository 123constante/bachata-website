# my-tickets-entry-points handover

Branch `claude/my-tickets-entry-points`, built on main 6c1352b (#1334 merged).

## Done
- Thank-you page: paid + signed in shows "See your tickets" -> `MY_TICKETS_PATH` (model import only, 44px). Every other state/viewer: no link.
- `accountRouting.ts`: `MY_TICKETS_ACCOUNT_PATH`.
- `DancerHome`: `dancer-home-tickets` full-width card, only when `flags.publicTicketing` and not loading and not signed out. Flag off = today's two cards.
- Tests: orderStatus (state x viewer table), new `DancerHome.ticketsRow.test.tsx` (flag x state table + path equality), flagOff (no tickets import in account, model-only import on thanks page).

## Red first
With the two source files reverted, 5 of the new cells failed (paid + signed in; flag-on rows); they pass with the change.

## Checks
| Check | Result |
|---|---|
| `npx vitest run src/modules/tickets src/components/account` | 21 files / 535 tests pass |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 24 of 24 links green |
| `check:bundle-budget` | Account chunk has no row in perf-budgets.json (not budgeted) |

## Not verified
A real Stripe purchase redirect; a real phone (390x844 / 320x568 walk is the orchestrator's).
Note: `qrcode-generator` was missing from node_modules in the worker; installed with `--no-save` only.
