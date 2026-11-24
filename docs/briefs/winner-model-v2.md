# Brief W1: winner journey model + six-field logic (Website, no visible UI change)
Branch: claude/winner-model-v2
Size: 4 files, 220 lines
Design: raffle winner journey, prototype v6 artifact https://claude.ai/artifact/KiDCbfUvZJhnxTbSXEraPo (profile steps section 8, refusals section 11). DESIGN-REGISTRY raffle row: prototype wins (owner 2026-11-24). This slice is pure logic: no screen changes.

## Do
1. `src/modules/raffle-win/model.ts` (edit, use scripts/safe-edit.py): `parseLock` understands the new refusal `{ok:false, reason:'profile_incomplete', missing:[...]}` (missing = subset of first_name, avatar_url, dance_role, based_city_id, nationality, languages; ignore unknown names). Add the reason to the reason union and a mapping that routes to profile steps. The OLD page `src/pages/RaffleWin.tsx` must keep working: map the new reason there to its existing error screen, no new UI.
2. New `src/modules/raffle-win/profileFields.ts`: `PROFILE_STEP_ORDER = ['avatar_url','first_name','dance_role','based_city_id','nationality','languages']`; `missingProfileFields(profileRow)` (NULL/blank text, languages null or empty array count empty); `introLineFor({isNewAccount, missing})`: "We need a few details before we can give you your QR." for a new account, "Almost there. We need a few more details." for an existing account missing fields, none when nothing missing; `stepCount(missing)`. Dance role stored value for Both is 'Lead and Follow' (label Both).
3. Tests: edit `src/modules/raffle-win/__tests__/model.test.ts`; new `__tests__/profileFields.test.ts` (each field empty alone, all empty, none empty, languages [], order, intro lines, parseLock new reason, unknown reason unchanged).

## Not in scope
Any screen, step shell, RPC call, flag change, old page removal.

## Done
PR (never merge), CI green, handover with Verified / Not verified. No UI so no tap table (state "no UI in this slice").
