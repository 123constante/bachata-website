# Brief: walk host picker (one lock per host, Dell RAM and CI rule, FIFO)
Brief-version: 2
Branch: claude/walk-host-lock
Lane: careful, Opus. 123constante/bachata-website, new scripts/lib/walk-hosts.mjs and its test only; no .github/**, no workflow, no package.json, no src/**; nothing is armed or run.
Serves: the owner and lead (two 390x844 walks never run together on one machine, and a walk never starts on the Dell during a CI job or low RAM).

## What main lacks
- No code decides which walk host may take the next walk; the contract (Part D, drill A35) needs one lock per host, FIFO waiting, and the Dell rule (only when no CI job is running and free RAM is above 3 GB). A pure picker is missing -- grep: pickWalkHost
- The host rules (Dell, main PC owner-busy flag, second laptop only after a passed day test run) exist only in prose in the acceptance contract, not as a validated table -- grep: WALK_HOST_RULES

## Files
scripts/lib/walk-hosts.mjs (new)
tests/walkHosts.test.ts (new)
docs/handover/walk-gate-judge-web.md

## What to build
1. New pure module `scripts/lib/walk-hosts.mjs` (no fs, no network, no clock, no env) exporting a frozen `WALK_HOST_RULES` table: `dell` (needs ciRunning=false and freeRamGb > 3), `pc` (needs ownerBusy=false), `laptop2` (needs dayTestRunPassed=true); every host also needs `locked=false` and `isSecretsRunner=false`.
2. Export `pickWalkHost(hosts, queue)` where `hosts` is an array of `{ name, locked, isSecretsRunner, ciRunning, freeRamGb, ownerBusy, dayTestRunPassed }` and `queue` is an array of `{ id, requestedAt }`. It serves the OLDEST request first (FIFO, ties broken by id) and returns `{ assign: { requestId, host } | null, waiting: [{ requestId, reason }] }`. A host never receives two walks at once; a host that is also the secrets-holding runner is never chosen; an unknown host name, a missing or non-number freeRamGb on the Dell, or malformed input yields no assignment with a reason, never a throw and never an assignment on doubt.
3. Export `hostLockKey(host, headSha)` returning a stable string `walk:<host>` for the lock and `build:<headSha>` for the build-once cache key; it throws on an empty host or a headSha that is not 40 hex characters.
4. Append a short "Part D host picker" note to docs/handover/walk-gate-judge-web.md saying what exists and that `.github/automation/walk-hosts.json` (a guard path, owner-merged) and the lock wiring are still left.

## Tests
Table-driven vitest in tests/walkHosts.test.ts, red first: Dell with CI running waits; Dell at 3.0 GB waits and at 3.1 GB runs; two requests for one free host run one after the other (first assigned, second waiting); FIFO order by requestedAt; secrets-runner host skipped; PC owner-busy waits; laptop2 before a passed day run waits; unknown host; NaN RAM; empty hosts; empty queue. Add at least four mutants (> to >=, drop the locked check, drop the secrets-runner check, sort newest first) and show each turns the suite red.

## Done when
- All rows pass, mutants killed, `npm run lint` green for scripts (check-script-conventions passes unchanged; the module has no isEntryPoint so TARGETS needs no change).
- PR body has a Verified / Not verified block: Verified = unit tests and mutants; Not verified = real hosts, real RAM and CI readings, the lock wiring.
- No file outside the list above changed.
