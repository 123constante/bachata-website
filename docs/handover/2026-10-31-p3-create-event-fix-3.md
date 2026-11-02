# Handover: PR #1208 create-event, fix round r3 (review r1 findings)

Brief: `docs/briefs/fix-1208-r3.md` on `brief/fix-1208-r3`. Review: `docs/review/pr-1208-r1.md` on `claude/review-1208-r1`.

## Done

| Finding | Result |
|---|---|
| F1 (medium) | Fixed. `useCreateSave.ts`: a `mounted` ref (false on unmount); after it, no `navigate`, no `setState`, no `onCreated` in `run`, `landed`, `discard`. The save itself goes on and storage still gets `created: true`; Home is still refreshed. Test `p3/new/__tests__/review3.test.tsx` (2 tests). Red first on `bb1d867`: `AssertionError: expected '/account/p3/events/ef04f395-...' to be '/account/p3/events'` (both tests). |
| F2 (copy) | Fixed. Refusal card: "The event was not saved; what you typed is still here." Generic card title `RESULT_COPY.nothingSaved` = "The event was not saved". F-15 named in the PR body. |
| F3 | Body only (GATE-RETRY replaces the card with `useGatedCopy()`; title string twice until then). |
| F4 | Deferred: separate GUARD-CI PR (CI sets no `VITE_ENABLE_ORGANISER_P3`); not in this brief. |
| F5 | Fixed in BUILD-INVENTORY: split verdicts #1, #13, #27, #40, #49, #58; what is missing for #47, #48, #49, #50, #55, #62, #69; #9 says input 140 / validation 120. |
| F6 | Fixed. `new/:seriesId/*` routes to the event page; comment at `paths.ts` on `recurring -> weekly`; tests: unknown kind, `at=form` with no kind (flow.render), `new/<id>/repeat` (P3Routes.exits, red first on old routes). |
| F7 | Fixed. `.p3-new-time` uses `minmax(0, 1fr)` and `min-width: 0` children. The walk spec gained one test: form at 360x740 (and the Sessions sheet), `scrollWidth <= innerWidth`. Honest: the OLD CSS also passes it in Chromium, so this is defensive, not red-first. |
| F8 | Fixed. `p3/new/pageModel.ts` owns `needsPagePick` / `PAGE_SET_PARAM`; the old `flows/new/whichPageModel` re-exports them. `p3/new` imports nothing from the old wizard. |

## Gates (local)

- `npx tsc --noEmit`: clean.
- `npm run lint`: 24 of 24 links green.
- `npx vitest run src/modules/organiser/p3`: 3223 of 3223, 61 files (after `npm i --no-save jsqr@1.4.0`; without it the 2 door files cannot load, sandbox only).
- `npm run build && npm run check:bundle-budget`, main and branch: both "All first-load JS budgets respected". dancer-app 371.8 KB / 47 files on both. One line differs: home `/city/:slug` 207.4 (main) vs 207.5 KB (branch): the lazy `paths` chunk is 308 B bigger from the PR's slice-1 `create*` helpers; r3 changed only comments in `paths.ts`.
- `walk-p3-create-kinds.spec.ts` with both P3 flags: 4 of 4 pass (kind picker at 390/360/430, form + Sessions sheet at 360).

## Left / next

- Lead's walk and merge. F4 GUARD-CI PR. F3 and F-15 with GATE-RETRY.
- `/code-review` was not run by this worker (no owner in the session).
