# Brief: pin the raffle lock payload in a test (P98)

Size: 1 test file, under 50 lines. Tests only. No app code, no design.

## Problem
docs/review/2507-r1.md (branch claude/review-2507-r1), nit 1: src/modules/raffle-win/RaffleWin.tsx about
line 145 sends the lock RPC with `p_never_been: needsTick`. No test pins that payload, so a regression that
always sends true (or false) would pass.

## Change
In the existing RaffleWin screen tests (src/modules/raffle-win/__tests__/screens.test.tsx, or the test file
that already mocks the lock RPC for RaffleWin; grep `raffle_win_lock` under src/modules/raffle-win), add two cases:
1. A night whose parsed `needs_tick` is false: lock it; assert the lock RPC was called with
   `p_never_been: false` (use expect.objectContaining on the RPC args).
2. A night with `needs_tick` true (or missing): tick the honesty box, lock; assert `p_never_been: true`.
Reuse the file's existing mocks and fixtures. Do not change RaffleWin.tsx or model.ts. If the RPC is not
mockable from the existing tests without app changes, STOP and say so under Not verified.

## Done when
- Website unit tests pass in CI.
- PR from claude/low-items-website-1 to main, title `test(raffle-win): pin lock payload p_never_been (P98)`.
- PR body: 3-line summary plus a Verified / Not verified block, and `Fixes P98`.
