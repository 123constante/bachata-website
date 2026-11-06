# Brief: walk gate decision (judge pass at the live head, or a valid owner waiver, else blocked)
Brief-version: 2
Branch: claude/walk-gate-decision
Lane: careful, Opus. 123constante/bachata-website, new scripts/lib/walk-gate-decision.mjs, its test and one TARGETS line in scripts/prove-entry-point-dispatch.mjs only; no .github/**, no workflow, no package.json, no src/**; nothing is armed or run.
Serves: the owner and lead (one pure answer to "may this UI PR merge without a phone walk", fail-closed, using the live head).

## What main lacks
- The judge handover says the caller must pass the PR's LIVE head to isPass, and a waiver is valid only at the pinned head; no module combines the verdict and the waiver into one merge decision -- grep: decideWalkGate
- Nothing returns the reasons a UI PR is blocked in one list (no verdict, wrong head, red, doubt, no valid waiver) -- grep: WALK_GATE_REASONS
- extends: the new script must be registered as an entry point so the proof guard sees it -- scripts/prove-entry-point-dispatch.mjs

## Files
scripts/lib/walk-gate-decision.mjs (new)
tests/walkGateDecision.test.ts (new)
scripts/prove-entry-point-dispatch.mjs
scripts/lib/walk-judge.mjs
scripts/lib/walk-waiver.mjs

## What to build
1. `decideWalkGate({ liveHeadSha, verdict, waiverRecord, waiverContext })` returns `{ allowed, via: 'judge'|'waiver'|null, reasons[] }`. Allowed only when `isPass(verdict, liveHeadSha)` is true, or `waiverValid(waiverRecord, {...waiverContext, pinnedHeadSha: liveHeadSha}).valid` is true. Imports both; never retypes their rules. Never throws; any missing or malformed input is blocked with a reason.
2. Export `WALK_GATE_REASONS` (a frozen table of reason ids) and make every blocked answer cite at least one id.
3. A CLI `--input <file.json>`: exit 0 allowed, 1 blocked or unreadable, 2 usage; register the script in TARGETS in scripts/prove-entry-point-dispatch.mjs.
4. A judge pass for another head, and a waiver pinned to another head, are both blocked even when the owner applied the label.

## Tests
Table-driven, red first (the test file fails to load before the module exists): verdict x head (same, other, missing, malformed) x waiver (none, owner at head, owner at old head, bot actor, owner equal to bot login) = every cell asserts allowed and via. Mutants: drop the head compare; accept a bot waiver; let doubt pass. Each must turn the suite red.

## Done when
Tests green; `node scripts/prove-entry-point-dispatch.mjs --coverage-only` passes; check-script-conventions passes unchanged. PR body carries Verified / Not verified (Not verified: no workflow calls it yet, Part E).
