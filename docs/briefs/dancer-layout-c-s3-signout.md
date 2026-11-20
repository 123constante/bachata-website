# Dancer layout C, slice S3: Sign out lives at the bottom of Account settings
Repo: 123constante/bachata-website. Branch: claude/dancer-layout-c-s3. Lane: normal. Model: sonnet.
Size: 3 files, 120 lines
Brief-version: 2
Design: DESIGN-REGISTRY row "Dancer dashboard" (layout C picked 2026-11-20). Prototype: https://claude.ai/artifact/HdwfoouZXEQvXM8LaXDyVF (option C, Me phone note: "Sign out now lives at the very bottom of Account settings (quiet text link, two-step confirm)"). Spec: docs/briefs/dancer-layout-c-spec.md.
Flag: `DANCER_LAYOUT_C_ENABLED` (src/modules/dancer-app/screens/home/layoutCFlag.ts; created by S1, else create the identical file). Flag OFF = page exactly as today.

## Files
- src/pages/AccountSettings.tsx
- src/pages/__tests__/AccountSettingsSignOutC.test.tsx (new)
- src/modules/dancer-app/screens/home/layoutCFlag.ts (new if S1 not landed)

## What changes
`pages/AccountSettings.tsx` already has `QuietSignOut` (quiet text link at the page foot, "Sign out?" two-step confirm, `useSignOutToHome`) shown only when flags.dashboardSwitchR4 is on. Show it ALSO when DANCER_LAYOUT_C_ENABLED is on, and then hide the plain "Sign out" Section (the card version) so there is exactly ONE Sign out on the page, at the very bottom, below every other section including "Sign out of all devices" and the delete area. Same copy and behaviour as the existing QuietSignOut; no new component.

## Prototype checklist
- [ ] flag ON: one quiet "Sign out" text link at the very bottom of Account settings
- [ ] tap -> "Sign out?" confirm (two steps), confirm -> signs out to home, failure message SIGN_OUT_FAILED shown
- [ ] flag ON: the card-style "Sign out" section is gone (exactly one Sign out control)
- [ ] "Sign out of all devices" stays where it is
- [ ] flag OFF: unchanged

## Done when
Test: render with flag on/off x dashboardSwitchR4 on/off; count Sign out controls (exactly 1 when either flag on, position last), flow reaches confirm and calls signOutToHome. Red on old source. LIST extras, never change them.

## TAP TABLE (mandatory in handover)
End the handover with a TAP TABLE: button | destination | prototype/OLD. One OLD row = keep building. A prototype element you cannot build: STOP, write it at the TOP of the handover. Checkpoint PR at 60% of your limit.

## Inventory first
INVENTORY.md for this slice = docs/briefs/dancer-layout-c-spec.md (live inventory of every row, tap and flag, already written). Before building, tick each Prototype checklist line against it; end the handover with a coverage count: "coverage N of N checklist lines built".

## What main lacks
- extends: Sign out as a single quiet link at the foot of Account settings when the layout C flag is on -- src/pages/AccountSettings.tsx
