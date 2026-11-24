# Handover: dancer onboarding v3 s3 (bio + links step, Home "Make your profile shine" card)

TOP: Whether `VITE_ENABLE_DANCER_LAYOUT_C` is on in prod is NOT known from here. If it is off, the Home card never shows (it lives only in `HomeCView`, per the brief). `VITE_ENABLE_DANCER_ONBOARDING_V3` must also be on. `onwardReturnTo('/app/home')` accepts `/app/home` (only `/app/welcome` and `/finish-profile` are refused).

## Done
- `stepsV3.tsx`: `BioLinksCardV3` (heading, sub, 3-row bio, link box, Finish, Skip for now).
- `bioModel.ts`: one link box -> `instagram` (handle, @name, instagram.com profile link) or `website_url` (scheme, slash, www., known TLD; `https://` added). Uses Edit's `draftFromProfile` / `validateDraft` / `buildDelta`, so only changed keys are sent and refusals use the Edit copy.
- `OnboardingV3.tsx`: `bio` after `photo`; `?step=bio` opens only that step (no progress bar; Back and Skip go to `end`).
- `ShineCard.tsx` + one line in `HomeCView` behind the v3 flag.
- Tests: `shineCard.test.tsx`, `bioLinksV3.test.tsx`; `partnerPhotoV3.test.tsx` has one test changed (Continue on photo now reaches the bio step, Skip ends on Home). Flag-off `homeLayoutC` and onboarding tests pass unmodified.

## Left / notes
- Finish with a bio+link can fire confetti twice: the step's own (`celebratesOnLeave`) plus the existing strength-crossing one in `writeMyDancerEdit`. Not changed (shared code).
- A bare handle with a dot that ends in a known TLD (e.g. `ana.co`) is read as a website. Edge case, same as the typed box being ambiguous.
- `journeyGuards.test.tsx` (homeRaffleWin `<img>`) fails on main too; not touched.
- Not done: 390x844 browser walk.

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Add (Home card) | /app/welcome?step=bio&returnTo=/app/home (bio+links screen) | prototype |
| Dismiss cross | hides card, writes localStorage timestamp, no navigation | prototype |
| Finish | saves changed keys, then /app/home (or returnTo end) | prototype |
| Skip for now | /app/home, no save | prototype |
| Back (in sequence) | photo step | prototype |
| Back (from Home Add) | /app/home | prototype |

tsc run on the branch before this doc: 0 errors.
