# p3-gate-guard-1 INVENTORY: every way out of Details / Prices

Written before any code edit, read on `main` 9a1ddce. "Dirty" = the screen holds typing not yet saved
(`useEditForm().dirty`, which feeds `useLeave(lines.length > 0 || uploading)` and so the leave store's `dirty`).
"Refused" = the last Save was refused with `onboarding_incomplete`: the A1 gate sheet opened
(`useSaveRun` -> `useGatedCopy` -> `gate.ts openGate`) and the typing was stored by `keepDraft`
(`DetailsScreen.tsx:56`, `PricesScreen.tsx:36`; `onboarding/keptDraft.ts`).

## How the exits are wired today

- The router blocker: `screens/EditTray.tsx:166-182` `useRouterBlocker` blocks EVERY in-app navigation that changes
  pathname while `isFormDirty()`; `useLeave` (`EditTray.tsx:191-200`) turns a blocked navigation into the
  "Leave without saving?" sheet (`EditTray.tsx:271-283`, `L.leaveTitle`, "Leave and lose them" = `p3-leave-go`).
- `GuardedBack` (`EditTray.tsx:203-211`): a `<Link>`; under the data router (`setRouterGuard(true)`) it lets the link
  navigate and the router blocker asks; with no data router it asks itself through `requestLeave`.
- The tab bar: `shell/P3Shell.tsx:62-69` `NavLink`s (Home / Events / Stats / You): plain navigations, the blocker asks.
- Phone Back: a history POP, the blocker asks.
- The gate sheet: `onboarding/GateSheet.tsx:69` Continue is `<Link to={withBack(start, at)} onClick={onClose}>`
  (a plain navigation, so the blocker asks: **the bug**); `GateSheet.tsx:76` Not now = `closeGate()`, no navigation.
- Save success: `EditTray.tsx:292-301` `useBackToEvent` navigates only once `dirty` is false (the effect waits for
  the saved draft to read clean), so the blocker never fires.

## The table (exit x dirty/clean x refused/not)

| # | Exit | Dirty | Refused | Today | Must |
|---|------|-------|---------|-------|------|
| 1 | Events tab (any tab) | dirty | no | leave sheet (blocker) | leave sheet |
| 2 | Events tab (any tab) | dirty | yes (after Not now) | leave sheet | leave sheet (the tab is not the checklist; nothing says the typing will come back) |
| 3 | Events tab (any tab) | clean | no | leaves, no sheet | leaves, no sheet |
| 4 | Events tab (any tab) | clean | yes (Not now, then Undo my changes) | leaves, no sheet | leaves, no sheet |
| 5 | Phone Back | dirty | no | leave sheet | leave sheet |
| 6 | Phone Back | dirty | yes (after Not now) | leave sheet | leave sheet |
| 7 | Phone Back | clean | no | leaves | leaves |
| 8 | Phone Back | clean | yes (then Undo) | leaves | leaves |
| 9 | Back link (`GuardedBack`) | dirty | no | leave sheet | leave sheet |
| 10 | Back link | dirty | yes (after Not now) | leave sheet | leave sheet |
| 11 | Back link | clean | no | leaves | leaves |
| 12 | Back link | clean | yes (then Undo) | leaves | leaves |
| 13 | Gate Continue | dirty | yes, typing stored | **leave sheet (BUG)** | **checklist, NO leave sheet**; typing comes back via "Back to your event" ("We kept your changes"); nothing sent |
| 14 | Gate Continue | dirty | yes, storage refused the draft (private mode / full) | leave sheet | leave sheet (the typing really would be lost: the sheet is true) |
| 15 | Gate Continue | dirty | no | unreachable: the gate opens only on a refusal | n/a |
| 16 | Gate Continue | clean | yes / no | unreachable: the gate sheet covers the screen, so nothing can be undone under it, and a clean screen cannot Save | n/a |
| 17 | Gate Not now | dirty | yes | sheet closes, stays on screen with typing, Save offered | same |
| 18 | Gate Not now | dirty | no / clean x any | unreachable (no gate without a refusal of a dirty Save) | n/a |
| 19 | Save success | dirty -> saved | no | back to event page with the toast, no sheet | same |
| 20 | Save success | clean | any | unreachable: Save is off with nothing changed (sends nothing) | n/a |
| 21 | Save success | dirty | yes | unreachable: a refused Save is not a success | n/a |

A later screen in the same frame that is NOT kept (Dates' date sheets, `DateFieldSheets.tsx:50`, which reuse
`useLeave`) keeps the leave sheet on every exit, gate Continue included: its typing is not stored, so the sheet is true.

## Fix rule (one place)

The router blocker lets a navigation through without asking only when ALL hold: it is the gate's Continue (the link
carries a state naming the refused screen's path), the path it leaves is that same screen, and a kept draft for
that event AND that screen is in storage right now. Everything else asks as today.

## Coverage

21 rows, 21 shown, none omitted (12 of them reachable-and-tested exit rows: 1-14 less the unreachable, plus 17, 19).
