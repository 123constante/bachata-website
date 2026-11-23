# Review 1988 (party chat S5: party card on Nights going-off screen, independent)

PR: 123constante/bachata-website #1988. Head reviewed: 80263c362b21c66cf2e4cd132df7716de222c0be. Source: the PR diff (4 files).

## Checks that hold
- Flag off: `NightsOff` renders the card only inside `{PARTY_CHAT_ENABLED() && ...}`. Flag off means the lazy component is never rendered, so the `PartyChatCard` chunk is not fetched and no party RPC runs. The module-level `lazyWithRetry(...)` only builds the lazy wrapper; the import runs on first render.
- `NightsOff` is unchanged apart from the card block: `ScreenTitle` "Nights", `EmptyState` (`nights-empty`, `MoonArt`, `NIGHTS_OFF_LINE`, `FIND_A_NIGHT`) and the root `data-testid` are untouched. Card sits between the title and the empty state, only when the flag is on.
- Lazy import shared: `partyChatCardLazy.ts` holds the single definition; `NightsScreen` now imports it (its old local `lazyWithRetry` const removed). `lazyWithRetry` and `Suspense` are still used in `NightsScreen` (no unused import). Both call sites wrap the card in `<Suspense fallback={null}>`.
- Test covers the keep-list: flag on (card text, `party-other-city`, title, `nights-empty`, `NIGHTS_OFF_LINE`, `FIND_A_NIGHT`) and flag off (no card, zero `party` RPC calls, title, copy, find-a-night link unchanged). Going switch is mocked off, so it exercises `NightsOff` via `/app/nights`.
- No SQL, auth or RPC contract change.

## Findings
1. NIT: the flag-off test waits a fixed 50 ms to prove no RPC; fine for a negative check, but it is time-based. Acceptable.
2. NIT: the `NightsScreen` import of `partyChatCardLazy` sits after other statements (below `PARTY_CHAT_ENABLED` import is fine; no ordering lint expected). CI lint is the check.

## Verdict: PASS

## Hard-tier: PASS (head 80263c362b21c66cf2e4cd132df7716de222c0be)
