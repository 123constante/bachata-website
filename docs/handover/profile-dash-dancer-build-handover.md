# Handover: dancer dashboard slice 1 (admin 1534) -- PARTIAL

Branch `claude/profile-dash-dancer-build`. No DB change, no `supabase/**`.

## Done
- `screens/home/homeModel.ts`: ONE mapping, profile shape -> Home main card (D1 stub, D2 unfinished, D3 complete), preview line, claim status copy (linked, no_match, ambiguous, email_unproven, unavailable).
- `screens/home/HomeMainCard.tsx`: draws it. Fixes 1-4 and 9 (D1 plain numbers line, D2 list once, D3 one CTA / Nights attended = `my_dancer_stats_v1.nights_went`, never a headline 0, preview row placeholder line).
- `screens/home/ClaimYourPage.tsx` (D4): re-runs no-arg `claim_my_dancer_profile_v1()`, shows returned status, one "Not me" dismissal; on `linked` drops persona caches and refetches. Wired into the no-profile branch of Home. No "In beta" / "day after" copy anywhere.
- Tests: `screens/home/__tests__/homeModel.test.ts` (table: shape x data, claim statuses). Old strength-tile tests rewritten for the new card.

## Left (next worker)
- Switch sheet + role strip (top right), Add a profile sheet, Account sheet (fix 7: one profile -> button reads "Account", `SwitcherGate.tsx`).
- Edit screen journey (fix 5): no hardcoded name/city, untouched Save sends nothing and says why it is off.
- Component-level tests for HomeMainCard / ClaimYourPage rendering each claim status (model is tested, the wiring only by the updated Home tests).
- Browser walk at 390x844 with prod-shaped data, screenshots, `docs/design/<pr>.md`, PR body (Verified / Phone QA blocks), per-job CI table.

## Checks
- `npx vitest run tests/client src/modules/dancer-app`: all pass (2250 + new).
- `npx tsc --noEmit -p .`: 0 errors. `npm run check:mojibake`: clean.

Not verified: `npm run lint`, other CI jobs, `pre-ship`, any browser walk, real-data shape survey (design record has the 2026-11-12 counts), phone QA.
