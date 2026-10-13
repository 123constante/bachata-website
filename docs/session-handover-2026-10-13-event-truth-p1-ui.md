# Session handover 2026-10-13 -- event-truth P1 UI slice (branch `arc/event-truth-p1p3-ui-b`)

Stopped at the context gate (30%). No PR (the orchestrator opens one). Full slice handover with findings,
mutants, matrix, CI results and the walk script: `docs/handover/event-truth-p1-ui.md`.

## Done
- a8efae3c applied unchanged as the first commit (bc47fff); byte pin a8d972e7 verified.
- Review fixes, tests, snapshot, e2e: second commit (see `git log -2`). Every unit suite green except the
  15 environment-only cases; mutation proof complete; lint chain 16/16; integrity job steps all green;
  typecheck workflow steps green; organiser-events (9) and organiser-loop (1) e2e specs green.

## Open
1. **pre-ship bundle ratchets RED on this branch, green on main** (`check:bundle-budget`: event route
   380.7 KB vs 380; `check:first-load-requests`: +2 on /parties, /classes, /faq, 3 landing pages).
   Cause located to: this tree builds a second root chunk (`root-CNfoH7Y2` beside `root-DoWiNfNR`) that
   statically imports `accountRouting` and `authRouting`; main has one root chunk. Root cause not yet found.
   Suspect the new `@/lib/eventCategory` import edges (`endedRun.ts`, `eventType.ts`). Reproduce:
   `npm run build:ship && npm run check:first-load-requests`, then diff `<link rel=modulepreload>` in
   `build/client/faq/index.html` against a main build. Do NOT raise the pins without a reason.
2. Full `npm run test:e2e` as one run (after the push): 2 failed   1 skipped   88 passed (3.5m) exit=1. The 2 failed are both tests/e2e/dancer-home.spec.ts (a finished dancer gets the dancer home; unfinished organiser hitting /account/o), a flow this slice does not touch, each at ~20 s under full-list load (the brief names dancer-first-gate round-trips as known load flakes). NOT re-run alone before the context gate: the next session must run `npx playwright test tests/e2e/dancer-home.spec.ts --project=chromium` alone and record it; if it reds alone, bisect against bc47fff.
3. Calendar masterclass / social tab parity with the lib: needs Ricky (`calendarUtils.ts` is ask-first);
   `it.todo` in `eventTruth.matrix.test.tsx`.
4. 390x844 walk on prod-shaped data (script in the slice handover, section 6).

## Next
Start from the prompt at the end of the final session message.
