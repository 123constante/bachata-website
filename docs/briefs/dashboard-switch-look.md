# Brief: dashboard switch, LOOK round (mockups only, no app code)

Goal: ONE round of 3 options, drawn as BEFORE/AFTER of the REAL current production screen, changed parts marked, everything else frozen. Output: one HTML file `docs/design/dashboard-switch/look-round.html` (390px wide frames) plus `INVENTORY.md` beside it.

Screens (3): (a) dancer switch sheet (top-right button, `src/components/account/profiles/ProfileSwitcher.tsx` mounted by `src/modules/dancer-app/shell/SwitcherGate.tsx`); (b) the same sheet inside the organiser area (`src/modules/organiser/profile/OrganiserSwitcher.tsx`); (c) organiser Switch page (`src/modules/organiser/switch/`), restyled to Round-4 canvas screen 5 (https://claude.ai/artifact/WyBvUeP1paFcUYR8frNyiR, page "Round 4: whole app"; white + orange #C2410C).

Step 1 INVENTORY.md first: every badge, line, control, state of each live screen, file:line cited, with a coverage count (N rows, N shown, none omitted). BEFORE frames are taken from the real code/states, not invented.

Owner decisions (fixed, do not re-ask):
- Switch = top-right button opening a sheet listing the user's profiles plus "Add a profile" (dancer design B: ~/.claude/plans/dancer-dashboard-option-b-switch.html).
- Button shown even with ONE profile.
- Teacher/DJ get NO dashboards now: a greyed "coming soon" row appears ONLY for a user who picked that role at onboarding (buyer onboarding rule: docs/design/ticket-buyer-onboarding-rule.md). Check how `SwitcherAreas` shows teacher/DJ today and mark the change.
- Teacher/DJ dashboards are NOT drawn.
Frames: each option shows BEFORE (live) beside AFTER, changed parts marked. Also draw states: 1 profile; dancer+organiser; dancer+picked-Teacher (coming soon). End with a KEEP-LIST (every live element) with tick boxes.
Tap targets 44px explicit px; 390x844. Entities in copy (&mdash; etc). No app code, no flag, no migrations. Publish the HTML only in the PR; do not merge.
