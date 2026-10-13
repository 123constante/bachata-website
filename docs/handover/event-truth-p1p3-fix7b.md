# Handover: FIX-7b (event route first-load budget, PR #750)

Branch `arc/event-truth-p1p3-fix7`, started from 30ba975b. **No source change:
the brief's step 4 applied.** No 0.5 KB margin can be bought by removing the
PR's own weight, and the one cut that does buy it is a raffle behaviour change
outside this PR. That needs an owner decision. `perf-budgets.json` is NOT touched.

## Reproduction (merged tree = branch + `origin/main` dd2014a, merge not pushed)

`npm run build && npm run check:bundle-budget` -- event (/event/:id):

| Tree | First-load gz | Bytes | Files |
|---|---|---|---|
| `origin/main` dd2014a | 379.8 KB | 388,922 | 47 |
| branch merged with main (local) | 380.0 KB | 389,109 | 47 |
| CI `bundle-budget` on #750 | 380.1 KB (OVER) | -- | 47 |

The local merged run printed `[ok]` at exactly 380.0 KB (exit 0). CI showed 380.1. Same
graph, gzip/rounding noise of about 0.1 KB. Either way it sits on the line.

## What the PR adds to /event (per-chunk gz diff, main -> merged)

| Chunk | main | merged | delta |
|---|---|---|---|
| `londonDate` -> `lib-event-rules` | 1,271 | 1,471 | **+200** |
| `buildEventJsonLd` | 10,241 | 10,203 | -38 |
| `event` | 45,329 | 45,337 | +8 |
| `wallClock` | 1,616 | 1,625 | +9 |
| `root` (2 chunks), `eventRpcs` | -- | -- | +8 |
| **total** | | | **+187 B** |

Responsible module: **`src/lib/eventCategory.ts`**. It now rides in the
`lib-event-rules` manual chunk (vite.chunks.ts, FIX-6), paired with `londonDate`.
The event route reaches it through `endedRun.ts -> wordForStored`. Because the
organiser editor uses every export, the whole module ships in that chunk, about
200 B gz. `ogCardRender.ts` and the other `src/lib` edits do not touch the
/event graph.

## Why no branch change

- Target for a 0.5 KB margin: <= 379.5 KB, which means cutting at least 501 B gz
  from the merged tree. The PR adds only 187 B, and **main itself has only 0.2 KB of
  margin**. Removing every byte the PR adds still leaves 379.8 KB.
- Even that 187 B cannot come out without a cost:
  - Taking `eventCategory` out of `lib-event-rules` brings back the extra
    chunk/request that FIX-1 measured (the chunk ratchet goes red).
  - Copying `wordForStored` into `endedRun` breaks the one-shared-mapping rule
    and the admin byte-twin.
  - Trimming `eventCategory.ts` breaks the byte-identical admin twin.

## Measured option for the owner (NOT applied)

Trial on a throwaway `origin/main` worktree: `RaffleBlock.tsx` loads
`RaffleEntryDialog` with `React.lazy` and mounts it only while `dialogOpen`.
Result: **event 370.7 KB across 46 files (-9.1 KB)**, and every other route
dropped 0.2 to 0.3 KB. Costs:
- `chunkRatchet` and the request pin for /event become exact-pin "under" breaks.
  They need re-pinning 47 -> 46, which tightens them.
- The dialog unmounts on close, so the close animation and the delayed reset
  effect change. The first tap waits for one chunk fetch.
- Raffle code is outside the event-truth arc.

**One-line proposal:** land the lazy `RaffleEntryDialog` as its own small PR on
main (re-pin /event chunk and request counts 47 -> 46, keep the dialog mounted
after first open so the close animation is unchanged), then re-run #750's
`bundle-budget`. #750 needs no change.

## Checks on the merged tree (branch unchanged)

| Command | Exit |
|---|---|
| `npm run build` | 0 |
| `npm run check:bundle-budget` | 0 locally (380.0 KB, on the line; CI 380.1 red) |
| `npm run check:first-load-requests` | 0 (6/6 pins match) |
| `npm run test:unit:offline -- src/modules/organiser src/lib` | 0 (113 files, 3982 passed, 1 skipped) |

Not this PR, do not touch: `db-contract-check` steps "unmigrated-DDL drift" and
"raffle anon-grant posture" are red on `main` already. `check-event-truth-v1` is
the expected #780 red.

## Verified
- The CI overage is reproduced on the merged tree. The PR's /event delta is +187 B gz, from `eventCategory.ts` riding
  `lib-event-rules`, measured chunk by chunk against a main build.
- main's own /event number (379.8 KB) leaves no route to a 0.5 KB margin through PR-only removal.
- The lazy-dialog option's KB and chunk numbers come from a real production build.

## Not verified
- The lazy-dialog option was not unit-tested, browser-walked or request-traced. It was
  discarded after measuring.
- The exact CI gzip figure (380.1) was not reproduced byte for byte. The local result was 380.0.
- No browser walk: there is no UI change in this slice.

---

## FIX-7c: event budget 380 -> 381 KB (owner decision 2026-10-13)

**What changed:** `perf-budgets.json` only. `routes["event (/event/:id)"].maxFirstLoadGzipKB`
380 -> 381, plus a dated justification key `//event-2026-10-13`, following the
`//parties+classes-2026-10-13` convention from #739. No other route, chunk ratchet,
puller ratchet or request pin changed. No guard asked for anything beyond the bump.

**Measured on a local merge of `origin/main` (not pushed, merge aborted afterwards):**

| Step | Exit | Notes |
|---|---|---|
| `npm ci` | 0 | main's lockfile |
| `npm run build` | 0 | |
| `npm run check:bundle-budget` | 0 | `[ok] event (/event/:id): 380.0 KB first-load JS across 47 files (budget 381 KB)` |
| `npm run check:first-load-requests` | 0 | all 6 prerendered routes match their pins |
| `npm run check:bundle-budget:self-test` | 0 | |
| `npm run check:first-load-requests:self-test` | 0 | |
| `node scripts/check-ci-budget.mjs --self-test` | 0 | ci-budget-guard covers `ci-budgets.json`, not this file; run for completeness |

No `npm run lint` link reads `perf-budgets.json` (the readers are `check-bundle-budget.mjs`,
`check-first-load-requests.mjs`, `pre-ship.mjs`, and the `perf-budget.yml` workflow).

### Verified
- The merged tree passes the event budget at 381 with 1.0 KB margin locally (380.0 KB).
- Request pins and both canaries still pass.

### Not verified
- CI `bundle-budget` on #750 after this push. Earlier CI read 380.1 KB, which passes 381.
- `ci-budget-guard`'s measure step (needs the Actions billing API; not run locally).
- The lazy `RaffleEntryDialog` follow-up PR has not been opened.
