# Handover: flake-routerunner-hooks
Done: tests/routeRunner.test.ts 'test-gate-hooks.sh passes on the real hooks' now uses a stall watchdog (30 s of no output) plus a 180 s ceiling instead of a flat 60 s wall-clock cap.
Root cause: the shell test is ~150 CPU-bound hook launches; wall time follows load (27 s idle, 49-66 s with 8 busy loops on 4 cores), so the flat cap failed beside other vitest workers. Exact CI error text not retrievable (no gh/API allowed); the expected signature is a spawnSync ETIMEDOUT / missing "PASS n cases".
Before/after (10 busy loops, 4 cores): old code 1 failed (64 s file); new code see PR body.
Left: nothing. Not verified: real CI failure logs.
