# Handover: site-keyboard-safe

Brief: `arc/briefs-dancer-rebuild:briefs/site-keyboard-safe.md`. Branch `claude/site-keyboard-safe`.

## Done
- `index.html` and `app/root.tsx` viewport meta: `interactive-widget=resizes-content` (decision 1).
- `useKeyboardInset` moved to `src/lib/keyboard/useKeyboardInset.ts`. The old organiser path is a re-export, so no organiser importer changed (decision 2).
- `src/lib/keyboard/keyboardSafe.ts` is installed once from `app/root.tsx`, loaded on idle (a static import put ~1.5 KB gz on every route and pushed dancer-app 0.8 KB over its budget). It does three things (decisions 2 to 4):
  - sets `data-keyboard-open` and `--keyboard-inset` on `<html>`;
  - hides the fixed bars that rest on the visible bottom edge;
  - scrolls the focused field so its top sits under the stacked sticky headers, inside its scrolling box, leaving room for the first result. The scroll is instant, it never moves focus, and it does nothing when the field and its first result are already visible.
- `src/index.css` has 3 rules: hidden bars, in-flow bars marked `[data-keyboard-hide]` (the organiser TabBar, one attribute), and extra scroll room equal to the overlay inset.
- `tests/e2e-phone/keyboard.phone.spec.ts`: 8 field rows, 2 keyboard modes (resize and overlay), at 390x844 and 360x640.
- Results (32 cells):

| Run | Result |
|---|---|
| Unfixed `main` | 15 failed, 17 passed. The onboarding row fails in 3 of 4 cells. |
| Fixed | 32 passed. |
| Mutant (install removed) | 15 failed. |
| Production build | 32 passed. |
| Full phone suite (static mount) | 220 passed, 74 skipped. |
| After the lazy mount: keyboard spec on dev, on prod build | 32 passed, 32 passed; mutant 5 of 8 selected cells red. |
| Bundle budget, first-load requests, chunk cycles | all exit 0 (dancer-app 360.5 of 361 KB). |

## Left / not covered by the spec
- These rows are not in the spec because their setup needs fake data that `fakeSupabase.mjs` does not have yet:
  - `/account/settings/delete` (needs the deletion-check RPC);
  - the organiser-area forms (`/account/o/team`, event editor sheets);
  - `/app/*` dancer forms;
  - the raffle dialog and the event guest list.
- Those fields still get the global behaviour.
- A real phone keyboard was not tested (no device here).

## Next steps
1. Add rows for the screens above. Each one needs a fake for the data it reads.
2. Ricky: phone test, on Android Chrome and on iOS Safari.

## PR
- #785 (https://github.com/123constante/bachata-website/pull/785). The body carries the inventory, the red, green and mutation runs, and the per-job CI table.
- Not deleted: the e2e smoke run created `docs/handover/dancer-rebuild-w2b/` and `docs/handover/dancer-rebuild-w2e/` as untracked folders. They are not committed and can be deleted.
