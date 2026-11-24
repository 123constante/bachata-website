# Handover: winner-model-v2 (W1)

Done: `parseLock` understands `profile_incomplete` (new outcome `{kind:'profile', missing}`, known names only, step order); new `profileFields.ts`; old `RaffleWin.tsx` maps the new outcome to its existing error screen. No UI in this slice, so no tap table.

## Verified
- vitest src/modules/raffle-win: 39 pass. tsc --noEmit: 0 errors. check:mojibake clean.

## Not verified
- No prod shape survey or phone walk (no UI, pure logic). Real RPC refusal shape not checked against the admin migration.
- Full CI not run locally.
