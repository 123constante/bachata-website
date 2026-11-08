# Ambassador link card: state inventory

Source: `src/modules/ambassador/link/LinkCard.tsx` (LC) and `trackerModel.ts` (TM), at this branch head.

| # | State | Where | What the person sees |
|---|-------|-------|----------------------|
| 1 | Loading | LC `LinkSection` (`links.length === 0`, no error) | Nothing |
| 2 | No links | LC `LinkSection` | Nothing |
| 3 | Load failure | LC `LinkSection`, `tracker.isError` | "We could not load the link." + Retry (`link-load-error`) |
| 4 | On (live, active) | TM `linkState`; TM `cardModel` | Counts, URL, Copy, Share (if supported), Switch off |
| 5 | Off | TM `cardModel` note `OFF_NOTE` / `OFF_NOTE_OTHER` | Note, URL, Copy, Switch on |
| 6 | Off, admin-locked, ambassador viewing | TM `cardModel` `disabledReason` | Switch on disabled + `LOCKED_REASON` |
| 7 | Off, admin-locked, admin viewing | TM `cardModel` | Switch on enabled, no reason |
| 8 | Not live | TM `cardModel` `NOT_LIVE_NOTE` | Note only; no copy, share or switch |
| 9 | Empty (0 joined, not "not live") | TM `cardModel` `empty` | `EMPTY_TEXT` / `EMPTY_TEXT_OTHER` |
| 10 | Counts | TM `cardModel` | "Joined N", "N set {City} as their city" |
| 11 | Copy ok / fail | LC `copied` | "Copied" for 2.5 s / "Could not copy..." |
| 12 | Share | LC `canShare` | Share button only if `navigator.share` exists |
| 13 | Confirm open | LC `confirming` | Confirm sentence, switch button, Cancel |
| 14 | Saving | LC `saving` / per-card `busy` | Confirm stays open, button reads "Saving..." |
| 15 | Save failed | LC `error`; TM `switchError` | Confirm stays open, error line (`switch-error`) |
| 16 | Several links (admin) | LC `showWho` | Title "{Name}'s {City} link"; wording without "your" |

Coverage: 16 states listed, 16 covered by tests in `__tests__/linkCard.test.tsx` (matrix covers 4 to 10, 16; behaviour tests cover 3, 6, 7, 11 to 15; 1 and 2 by the empty-state test).
