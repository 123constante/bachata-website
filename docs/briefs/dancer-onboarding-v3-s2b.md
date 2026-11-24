# Dancer onboarding v3, UI slice 2b: partner yes/no + bottom sheet, photo, end on Home

Repo: 123constante/bachata-website
Branch: claude/dancer-onboarding-v3-s2b
Size: 4 files, 360 lines (incl. tests)

## Goal
Behind `VITE_ENABLE_DANCER_ONBOARDING_V3`: after years, dancers get "Looking for a dance partner?" (yes opens a bottom sheet), then the required photo screen; the flow then ends on today's real Home. Non-dancers skip the partner screen.
Branch from `main` AFTER slice 2a merged (`claude/dancer-onboarding-v3-s2a`: `OnboardingV3.tsx`, `stepsV3.tsx` exist, marker `// s2b replaces`). If absent, STOP. Needs DB slice 2 applied (partner keys): confirm the six keys in the parsed `MyDancerEdit` (slice 1) and in prod; else STOP and report at the top.

## Design pointer
DESIGN-REGISTRY row "Dancer onboarding" (`~/.claude/plans/DESIGN-REGISTRY.md`). The owner pick beats any older issue.
Prototype: v8 https://claude.ai/artifact/DczcxwnM3jCErXLCQkX5Dv (repo copy: admin repo `docs/design/dancer-onboarding/mockup-v8-after-code.html`, screens `i==13` incl. the `.sheet`, and `i==9`). Home card (not this slice): https://claude.ai/artifact/37jjwbd4jdV5r6ooMKYnCB.

## Files (verified on origin/main unless NEW)
- EDIT `src/modules/dancer-app/screens/onboarding/OnboardingV3.tsx` (from s2a): add `partner` and `photo` to the driver; after `photo` go to the end (or to `bio` once s3 lands: leave the `// s3 inserts bio` marker); end = `onboardingEnd(returnTo)` which resolves to `APP_HOME_PATH` (`/app/home`; `/account/dancer` redirects there for allowed users, `src/lib/accountRouting.ts`). The final "You're in"/"Nice work" card is NOT used under v3.
- EDIT `src/modules/dancer-app/screens/onboarding/stepsV3.tsx`: `PartnerCardV3`, `PartnerSheetV3`, `PhotoCardV3`.
- NEW `src/modules/dancer-app/screens/onboarding/__tests__/partnerPhotoV3.test.tsx`.
- Reuse (do not edit): `photoHandoff` / `PHOTO_HANDOFF` in `./steps` (hand-off to `/app/me/photo?return=...`, validated by `screens/photo/PhotoScreen.tsx`); `ui.tsx` pieces; `diffDelta`.
- 4th file only if needed: `modelV3.ts` for the partner draft shape and vocabulary constants.

## Save contract (DB slice 2, client side)
`save_my_dancer_profile_v2` keys: `looking_for_partner` (bool), `partner_search_role` (text or null), `partner_years_min` / `partner_years_max` (int, max >= min, max needs min, or null), `partner_practice_goals` (text[]), `partner_details` (note, max 300). NO phone, NO `partner_search_level`. "No" saves `looking_for_partner: false` and sends no other partner key. Vocabulary for kind and role: read the DB slice's allowed values (admin repo migration for `save_my_dancer_profile_v2`; today's UI lists are `PARTNER_PRACTICE_GOAL_OPTIONS` and `PARTNER_SEARCH_ROLE_OPTIONS` in `src/components/profile/dancerConstants.ts`). Send only values the server accepts.

## Prototype checklist
Partner screen (`i==13`)
- [ ] Heading "Looking for a dance partner?", sub "Say yes and we show you to dancers who want a partner."
- [ ] Two single-pick rows: "Yes, I am" (handshake icon) and "No, just social dancing" (smile icon), tick when picked.
- [ ] Picking "Yes, I am" opens the bottom sheet at once (`S.sheet = partner=='yes'`); picking "No" closes it.
- [ ] "Continue" disabled until a choice is made, and while Yes has no preferred role; Back goes to years.
- [ ] Screen is skipped (both directions) when "Dancer" is not among the picked roles (`stepsFor`).
Bottom sheet "Your ideal partner"
- [ ] Grab handle bar on top; title "Your ideal partner"; slides over the screen bottom.
- [ ] Section "What kind": multi-pick chips; show the prototype labels "Social dancing", "Classes", "Performance", "Competition" (owner 2026-11-24: match the mockup). Map labels to the stored values the server accepts: Social dancing -> "Social dancing", Classes -> "Practice", Performance -> "Performance", Competition -> "Competition". Label map lives in the client only; no DB change.
- [ ] Section "Their role": single-pick chips "Leader", "Follower", "Either" (owner 2026-11-24: match the mockup; map "Either" to the stored value "Lead and Follow", which the server accepts; "Leader" and "Follower" store as is).
- [ ] Section "Years dancing": single-pick chips "0-2", "2-5", "5+", "Any" mapped to `partner_years_min/max` (0-2 -> 0,2; 2-5 -> 2,5; 5+ -> 5,null; Any -> null,null).
- [ ] Text input placeholder "A line to potential partners" -> `partner_details` (max 300).
- [ ] Button "Save": closes the sheet, keeps the answers in the screen state; the real save happens on "Continue" (one write of the changed keys). Dismissing the sheet by its backdrop/handle keeps drafts.
- [ ] Re-picking "Yes" reopens the sheet with the earlier answers; reopening the app resumes with server values.
Photo screen (`i==9`)
- [ ] Heading "Show us your face", sub "A photo is required. Partners and organisers need to know who you are."
- [ ] Large photo tile: empty state camera icon + "Tap to add a photo"; filled state the photo + "Photo added. Tap to change".
- [ ] "Continue" disabled until a photo exists (`avatar_url`). The tile opens the EXISTING photo screen (`photoHandoff`, camera/library + crop); coming back lands on the photo step with the photo shown. This round trip differs from the prototype's inline tile: say so in the handover, it is not an OLD row as long as the return lands on the v3 shell, not today's "You're in".
- [ ] Confetti on leaving partner and photo (forward), none going Back.
End
- [ ] After photo (or after the last v3 step) `onboardingEnd(returnTo)` replaces history and lands on the real `/app/home`; browser Back does not reopen onboarding. No "You're in", "Nice work" or welcome screen under v3.
- [ ] Resume: a person with partner answered, photo missing resumes on photo; all done goes straight to Home.

## Rules
- No schema/RPC edits; gate and `profile_complete_v1` untouched.
- Flag-off behaviour equals today's exactly (test: flag off renders the old cards, old tests pass unmodified).
- Per-screen unit keep-list test for partner, sheet, photo, end: every heading, sub, option, chip, button, disabled state above.
- Any tap that leaves the prototype = not done. End the handover with a TAP TABLE: button | destination | prototype/OLD. One OLD row = keep building.
- An element you cannot build: STOP and write it at the TOP of the handover.
- PR body carries the tap table. Never merge. Over size: stop at a clean boundary, write `PARTIAL [worker-done]`.
