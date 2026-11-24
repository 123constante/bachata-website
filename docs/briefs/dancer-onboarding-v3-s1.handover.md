# Handover: dancer onboarding v3, slice 1

Nothing blocked. DB keys confirmed in prod: `my_dancer_edit_v1` and `save_my_dancer_profile_v2` both contain looking_for_partner, partner_search_role, partner_years_min/max, partner_details, partner_practice_goals (read-only pg_proc check).

## Done
- `onboardingV3Flag.ts` (default off, env var not set anywhere).
- `MyDancerEdit` six optional partner fields + six `SAVE_KEYS`; `parseMyDancerEdit` reads them (wrong/absent -> null / []).
- `modelV3.ts`: STEPS_V3, stepsFor, YEAR_BANDS_V3, yearForBandV3, bandForYearV3, stepIsSatisfied, celebratesOnLeave, resumeStep.
- `__tests__/modelV3.test.ts`.
- Nothing outside onboardingV3Flag/modelV3/tests imports the new files (flag off = today).

## Left
s2a, s2b, s3 (screens).

## Checks
- tsc run on branch head: 0 errors.
- vitest src/modules/dancer-app + tests/client/dancerAppApi: 1731 pass, 1 fail: `journeyGuards` on `screens/home/homeRaffleWin.tsx` (hand-drawn img). Fails identically on main without my changes; not touched here.
- Not verified: browser walk (no UI), CI jobs.

## TAP TABLE
no UI taps
