# Handover: dancer onboarding v3, slice 2b

Photo round trip differs from the prototype's inline tile: the tile opens the existing /app/me/photo (photoHandoff) and returns to the v3 shell, landing on the photo step with the photo shown (sessionStorage flag; without it a finished profile goes Home). Not an OLD row.
Not built: Neon Night look, bio step (s3 marker `// s3 inserts bio` in nextAfter). Sheet is a plain fixed bottom panel (no animation), not the shadcn drawer.
Partner "years" sheet answer: max null is not re-sent when already null (diffDelta), as intended.

## Done
- modelV3.ts: label->stored maps (kinds, role, years), PartnerDraftV3, partnerDraftFrom, partnerDelta.
- stepsV3.tsx: PartnerCardV3, PartnerSheetV3, PhotoCardV3. OnboardingV3.tsx: partner + photo in driver, end on onboardingEnd.
- Tests: partnerPhotoV3.test.tsx (12); s2a years test updated (years now goes to partner).

## Checks
- Prod: save_my_dancer_profile_v2 body mentions all six partner keys (SELECT on pg_proc). Six keys present in MyDancerEdit.
- vitest src/modules/dancer-app: all pass except journeyGuards homeRaffleWin.tsx (same on main).
- tsc -p tsconfig.app.json: 0 new error classes in branch files beyond the lucide ComponentType / `as Partial` typing errors s2a already carries (same pattern, in s2a files and mine). check:mojibake ok.
- Not verified: 390x844 browser walk, CI jobs, partner vocabulary value check against the server beyond the function mention, bottom-sheet slide animation.

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Years Continue | partner (dancer) / photo | prototype |
| Yes, I am | opens sheet | prototype |
| No, just social dancing | closes sheet, ticks | prototype |
| Sheet Save / backdrop / handle | closes sheet, drafts kept | prototype |
| Partner Continue | one save, confetti, photo | prototype |
| Photo tile | /app/me/photo?return=/app/welcome | prototype (round trip, noted) |
| Photo Continue | confetti, /app/home (replace) | prototype |
| Back | previous step, no confetti | prototype |
