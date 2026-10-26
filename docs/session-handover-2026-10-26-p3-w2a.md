# Handover: P3 W2a event page + Status sheet (2026-10-26) -- PARTIAL

Branch `claude/p3-w2a-event-page`, PR #1057 (bot-authored). Brief `brief/p3-w2a-event-page` (sha 304a2258).
Ticket `dt_5d88df052e0f`. Flag `organiserP3` OFF. Stopped at the owner's 30% context gate.
Design record: `docs/design/1057.md`.

## Done
- Route `/account/p3/events/:seriesId` (`P3_PATHS.event(id)`); Events and Home rows link to it.
- `p3/data/eventPage.ts` (pure): page model from the R1 workspace (`useEventWorkspace` / `parseEventWorkspace`,
  programme via `programmeSeriesModel.parseTree`), W0 model only. `parseEventWorkspace` now carries `meta.total`
  ("This page lists the newest 100 of 131 dates"). Status rows per lifecycle, End it plan, keepable dates.
- `screens/EventPage.tsx`: header, ONE status row, Sessions (festival days), Coming up, About; loading /
  not yours / not found / error states. `screens/StatusSheet.tsx`: Put it live / Hide (+Undo) / Show (+Undo) /
  Back to draft (greyed) / End it (tonight question) / Stop repeating (keep list) / Cancel the event (greyed W2c
  slot) / Remove (confirm). Sends via `useRunCommands` -> `envelope()`.
- `COMMAND_COPY`: end_run / stop_repeating / not-ready go-live refusals (red-first: 7 tests failed without them).
- Labels added to `L`; tokens-only CSS in `p3.css`; new contrast pairs in the contrast test.
- Tests: `eventPage.matrix.test.tsx` (18 shapes x header, rows, untouched-sends-nothing, greyed-sends-nothing,
  each command payload, refusals, read states; probes F13, #8c, R-pol-hide), `eventPage.send.test.tsx`
  (real envelope path). Full unit suite green in pre-push (15054).
- Prod shape survey (read-only, counts) in the PR body / design record.

## Local CI (this sandbox)
Green: integrity, legacy-tables, legacy-program-rpcs, lint:architecture, check:images (AUDIT_STRICT=1, after the
cover `loading` fix), image-widths, plan-hygiene canary, workflow-artifact, mojibake canary + guard, entry-point,
going-legacy, rpc-typing, wallclock, dancer-isolation, unit:timing, docs-only self-test, workflow masking /
notification / no-preview, budget canaries, build, bundle-budget, first-load requests, chunk-cycles,
migration-stamps, lint, unit suite.
Red: `test:e2e` 3 of 165 (auth-magic-link-returnto, organiser-home "load failure ... Retry", organiser-onboarding
"Sign in link returns") -- R1/auth specs this diff does not touch; NOT yet re-run on main to prove pre-existing.
Not run: phone suite (`playwright.phone.config.ts`), build smoke (`playwright.build.config.ts`).
Sandbox note: run hooks and vitest with `NODE_PATH=` (the container's global NODE_PATH makes
`tests/integrityCouldNotRun.test.ts` fail on main too).

## Open / next (in order)
1. Re-run the 3 red e2e specs on `origin/main` in a worktree; if red there too, say so on the PR; else fix.
2. Run the phone suite and the build smoke.
3. Walk: copy `docs/handover/p3-w2a-walk/walk.phone.spec.ts.txt` to `tests/e2e-phone/zz-walk.phone.spec.ts`,
   export the fixtures to JSON (vitest one-liner writing `SHAPES` from `p3/screens/__tests__/wsFixtures.ts`),
   run `SHAPES_JSON=<json> SHOTS=docs/handover/p3-w2a-walk VITE_ENABLE_ORGANISER_P3=true NODE_PATH= npx playwright
   test --config playwright.phone.config.ts zz-walk`, delete the spec, commit the PNGs, update design record stage 4.
4. Fill the PR body (template: Verified on real data + Phone QA sections) and the per-job CI table from GitHub.
5. Known gaps (documented, not bugs): stored role `mc` not shown; per-date session changes not drawn (W2b);
   a broken cover URL leaves an empty 16:9 box.
