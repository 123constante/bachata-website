# Handover: dancer onboarding v3, slice 2a

Style labels: the live list FAVORITE_STYLE_OPTIONS is used (owner decision 2026-11-24); prototype labels differ.
Not built here: the Neon Night look (full-bleed backdrop, Anton headings, pink/orange gradient). Today's dancer-app card look is used.
Icons: lucide (PartyPopper, Ticket, GraduationCap, Headphones, CalendarDays, Check, ChevronLeft), not the prototype emoji; the dancer app uses lucide, not emoji.

## Done
- OnboardingV3.tsx shell (progress segments, Back, resume, pre-steps with the existing NameCard/CityCard/RoleCard, confetti on leaving styles/years).
- stepsV3.tsx: RolesCardV3, StylesCardV3, YearsCardV3.
- OnboardingScreen.tsx: flag switch only.
- __tests__/onboardingV3.test.tsx (flag on via stubEnv; flag off = existing onboarding tests, unmodified, pass).

## Left
s2b (partner) and s3 (photo, bio). Marked "s2b replaces" in OnboardingV3.tsx: after years, and when resume lands on partner/photo, the flow ends on onboardingEnd.

## Checks
- tsc --noEmit on branch base+changes: 0 errors. check:mojibake ok.
- vitest src/modules/dancer-app: 1578 pass, 1 fail (journeyGuards, homeRaffleWin.tsx), same as on main.
- Not verified: 390x844 browser walk, CI jobs, real-data shape survey (no schema change, UI only).

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Roles Continue | styles | prototype |
| Styles Continue | years | prototype |
| Years Continue | onboardingEnd (Home or returnTo), replace | prototype (s2b replaces) |
| Back | previous step | prototype |
| Role/style/year rows | toggle in place | prototype |
