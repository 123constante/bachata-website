# Handover: React #421 fix on `/event/:id` (B + C)

Ticket dt_024b76dee7dc. Brief `docs/briefs/hydration-421-fix.md`. Findings:
`docs/handover-hydration-421.md` on `claude/hydration-421-trace`.

## What changed
- `BentoPage.tsx` (B): the RSVP and level-rating/badge `<Suspense>` slots are now
  `React.memo` components `RsvpSlot` / `LevelSlot` taking primitives or
  snapshot-stable props; `snapshotQueryKey` and the badge element are built inside.
- `BentoPage.tsx` (C): the three `import()` calls (RsvpBlock, DerivedLevelBadge,
  LevelRatingPrompt) fire at module scope (client only), like FestivalDetail in
  `src/pages/EventPage.tsx`. `lazyWithRetry` now wraps the same factories.
- `tests/e2e/event-hydration-421.spec.ts` (new, added by name to `test:e2e`).
- `src/modules/event-page/bento/__tests__/lazySlotHydration.test.tsx` (new unit
  guard, with a control that reproduces #421 without the memo).
- `derivedBadgeGating.test.ts`: first regex loosened from
  `occurrence\?\.isCancelled \? badge :` to `isCancelled \? badge :` because the
  gating expression moved into `LevelSlot` (behaviour unchanged). Outside the
  pinned list, forced by the move.
- `perf-budgets.json` untouched.

## Measured (production build, prod data, 390x844, CDP CPU 4x, 1000 ms delay on lazy /assets chunks)
Spec run 5 times, two events per run (ongoing ronald-alba-..., ended the-camden-tuesdays):

| build | passes | failures |
|---|---|---|
| unfixed main (995c841) | 0/10 | 10/10, each `Minified React error #421` |
| this branch | 10/10 | 0 |

Assertion is therefore zero errors (`HYDRATION_MAX_ERRORS=0`). Knobs:
`HYDRATION_CHUNK_DELAY_MS`, `HYDRATION_CPU_RATE`, `HYDRATION_BASE_URL`.
Note: the spec counts matching console messages per load, so it does not give
the per-run #421 counts of the trace doc (those were 2-3 per load on main).

## CI steps run locally on this branch (all exit 0 unless noted)
build; `tsc --noEmit`; `check:bundle-budget`; `check:first-load-requests`;
`check:chunk-cycles`; `check:rpc-typing`; `check:legacy-tables`;
`lint:architecture`; `check:mojibake`; vitest `src/modules/event-page` (225 pass).
Full `test:unit`: 10152 pass, 15 fail in 4 files, none touching BentoPage:
`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` (live-DB contract
tests, sandbox network) and `integrityCouldNotRun` (5, fails identically on
unfixed main). The three contract files were not re-run on main. The run also
rewrote 10 snapshot files (line endings); those were reverted, not committed.
eslint on BentoPage.tsx: 1 error (`react-hooks/set-state-in-effect`, line ~223)
exists on unfixed main too.

## Not verified
- Real phone, real network, Vercel (sandbox only; the live site is blocked).
- RSVP placeholder / level card flicker at 390x844 was NOT eyeballed in a
  screenshot walk; only the absence of hydration errors was measured.
- Playwright/e2e-smoke on GitHub (billing may refuse Actions).
- The spec SKIPS in CI (placeholder keys, no real event data); it only guards
  where a production build and real data exist, i.e. a local/sandbox run.
- Not every workflow (db-contract-check etc.) was run; they need live DB/secrets.
- Sandbox SSR answers these pages with HTTP 500 after a full stream in one build
  variant (entry.server onError); the spec judges the body, not the status.
