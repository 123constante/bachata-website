# Dancer onboarding v3, UI slice 1: flag, types, RPC wrappers, step model

Repo: 123constante/bachata-website
Branch: claude/dancer-onboarding-v3-s1
Size: 5 files, 330 lines (incl. tests)

## Goal
Lay the non-visual base for the new post-code dancer onboarding: the flag `VITE_ENABLE_DANCER_ONBOARDING_V3` (default off), the partner keys in the dancer types/parser/save keys, and a pure step model (order, skip, required, resume, celebrate rules). No screen changes. Flag off = today, byte for byte.
Later slices (each branches from `main` AFTER the previous one merged): s2a, s2b, s3.

## Design pointer
DESIGN-REGISTRY row "Dancer onboarding" (`~/.claude/plans/DESIGN-REGISTRY.md`). The owner pick beats any older issue, queue row or acceptance contract.
Prototype: v8 https://claude.ai/artifact/DczcxwnM3jCErXLCQkX5Dv (repo copy in the admin repo: `docs/design/dancer-onboarding/mockup-v8-after-code.html`, order logic in its `ORDER`/`go()`); Home card https://claude.ai/artifact/37jjwbd4jdV5r6ooMKYnCB.

## Depends on DB slice 2 (separate, running)
`my_dancer_edit_v1` read and `save_my_dancer_profile_v2` write gain: `looking_for_partner`, `partner_search_role`, `partner_years_min`, `partner_years_max`, `partner_details`, `partner_practice_goals`. This slice only adds the CLIENT side. Before coding, confirm the keys exist: check `src/integrations/supabase/types.ts` and the DB slice PR/merge on admin `main` (migration named like `*partner*self_serve*`). If the keys are absent from prod, STOP and report at the top of the handover; do not guess.

## Files (all verified on origin/main)
- NEW `src/modules/dancer-app/screens/onboarding/onboardingV3Flag.ts`: `export const DANCER_ONBOARDING_V3_ENABLED: boolean = import.meta.env.VITE_ENABLE_DANCER_ONBOARDING_V3 === 'true';` same shape and doc comment as `src/modules/dancer-app/screens/home/layoutCFlag.ts`. Stays inside the dancer-app module (`scripts/check-dancer-area-isolation.mjs`). Do NOT set the env var anywhere; the owner flips it in Vercel.
- EDIT `src/modules/dancer-app/api/types.ts`: add to `MyDancerEdit` the OPTIONAL fields `looking_for_partner?: boolean | null`, `partner_search_role?: string | null`, `partner_years_min?: number | null`, `partner_years_max?: number | null`, `partner_details?: string | null`, `partner_practice_goals?: string[]` (optional so `fixtures.ts` and every existing test object still type-check; the parser always sets them). Add the same six keys to `SAVE_KEYS` (`DancerDelta` follows).
- EDIT `src/modules/dancer-app/api/rpc.ts`: `parseMyDancerEdit` reads the six keys (boolean/number/string/array, absent or wrong type -> null / `[]`, never throws). Do NOT add `partner_search_level` (retired). `saveMyDancerProfile`/`saveMyBuyerRoles` wrappers already exist: reuse, no new RPC wrapper.
- NEW `src/modules/dancer-app/screens/onboarding/modelV3.ts`: pure functions (below). Do not edit `model.ts`.
- NEW `src/modules/dancer-app/screens/onboarding/__tests__/modelV3.test.ts`: flag + parser + model tests.

## Prototype checklist (this slice: order, rules, tables only; no pixels)
- [ ] `STEPS_V3 = ['roles','styles','years','partner','photo','bio']` in exactly this order (prototype `STEPS=['Roles','Styles','Years','Partner','Photo','Bio+links']`, `ORDER=[1,11,10,13,9,12]`).
- [ ] `stepsFor(buyerRoles)`: `partner` is removed when `dancer` is NOT among the picked roles (prototype `go()`: skipped in BOTH directions, forward and Back). Progress segment count = length of this list (prototype shows 6 segments, one `on` per step reached).
- [ ] Required: roles needs >= 1 picked (prototype: Continue disabled with none); styles >= 1; years one band; photo present (`avatar_url`). Partner needs a yes/no; YES needs a preferred role to save (prototype: Continue disabled when `yes` and no role). Bio+links optional ("Skip for now").
- [ ] `YEAR_BANDS_V3` (5 bands, labels verbatim): "Under 1 year", "1 to 2 years", "3 to 5 years", "6 to 10 years", "Over 10 years"; each stores `now.getFullYear() - N` with N = 0, 2, 5, 10, 16 (prototype 2026, 2024, 2021, 2016, 2010). `bandForYearV3` reads a stored year back (age <1, <=2, <=5, <=10, else). Do NOT touch the shared 4-band `YEAR_BANDS` in `api/nextStep.ts` (Edit uses it).
- [ ] `celebratesOnLeave(step, {bio, link})`: true when LEAVING `styles`, `years`, `partner` or `photo` going forward, and `bio` only when a bio or a link was filled (prototype `cel`); never for `roles`, never going Back.
- [ ] `resumeStep(profile)`: first v3 step still missing from SERVER data: roles (`buyer_roles` empty), styles (`favorite_styles` empty), years (`dance_started_year` null), partner (dancer + `looking_for_partner` null/undefined), photo (`avatar_url` null); `bio` is optional so it never counts as missing; all done -> `'done'`. The pre-steps name/city/role are NOT in this model (s2a keeps the existing cards for them).
- [ ] Partner kind/role/years vocab is NOT decided here (s2b reads it from the DB slice); export nothing for it.

## Rules
- No schema/RPC edits, no change to `profile_complete_v1`, the gate or `strength`. Client enforces styles + years required only inside the v3 shell (later slices).
- Flag-off behaviour must equal today's exactly: test that with the flag off nothing imports/uses modelV3 and existing onboarding tests pass unchanged.
- Per-screen keep-list test: none (no screen); instead assert the parser still returns every existing field unchanged for the existing fixtures.
- Any tap that leaves the prototype = not done. End the handover with a TAP TABLE (button | destination | prototype/OLD); this slice has no taps, write "no UI taps". One OLD row = keep building.
- An element you cannot build: STOP and write it at the TOP of the handover; never ship a "remaining differences" list as done.
- PR body carries the tap table. Never merge. Size over 5 files / 400 lines: stop at a clean boundary, write `PARTIAL [worker-done]`.
