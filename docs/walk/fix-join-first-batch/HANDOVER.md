# Handover: walk-1291-r2 (browser walk of PR #1291, 390x844)

Branch `claude/walk-1291-r2`, from `origin/claude/fix-join-first-batch` tip e98f5fa (merge-base verified equal). No product code changed: one spec, pictures, two docs.

- Spec: `tests/e2e/walk-fix-join-first-batch.spec.ts` (NOT in the CI gate list). Inventory: `INVENTORY.md`. Pictures: `01..15-*.png` in this folder.
- Run: `VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-fix-join-first-batch.spec.ts --project=chromium`

## Pass table (14 tests, 15 pictures; test 05 writes pictures 05 and 06)
| Check | Result |
|---|---|
| No sideways scroll, every state | pass 15/15 |
| Every button/link in the screen's own container >= 44px tall | pass 15/15 (see finding 1 for what is outside the container) |
| Exactly one primary action (banner Continue; gate Continue; Review button; used-link Sign in / Switch) | pass |
| A live control on every stop screen (12, 14, 15) | pass |
| "Back to your event" only with a valid event `back` and 0 left (07 yes; 08-11 no; 06 has items left, no) | pass |
| Tap on 07's button lands on `/account/p3/events/<id>` | pass |
| 08-11 "Go to Home" lands on P3 Home | pass |
| 13 the redeemer lands on `/account/p3?o=<org>` | pass |
| 15 same-name page + server `used` = other-account screen, stays on /invite | pass |
| Banner never says "works as usual" (checked in the container text of every state) | pass |

## Findings (no product fix made)
1. Outside the screens' own containers, not caused by this PR: on `/invite/:token` the site breadcrumb "Home" link is 49x17 (see 12 and 14, the top "Home > Join organiser team" line), and the site footer links on /invite are 14px tall. The spec scopes the 44px check to `[data-testid="join-step"]` for /invite and `.p3-theme` for P3, so these are reported, not asserted.
2. Screen 14 (other account) and 12 (signed out) are both fine on copy; 14's two secondary buttons plus "Go to Bachata Calendar" sit under one primary as intended.

## Not verified
- Real data: no shape survey (Supabase) and no real organiser; every server answer is simulated. The handover's item 3 (survey of organisers by `left` count) is still open.
- Not walked: admin banner, the Live screen's "Back to your event", signed-out Review sign-in carrying `back`.
- Gap known from the PR (`back` lost via /app or dancer profile; Back from the event can land on the finished Review) is not exercised.
- Light theme only. 320x568 not walked.
- `npm run test:e2e` / `test:e2e:p3` not run here. `p3-gate-sheet.spec.ts` Part 1 and `walk-p3-series-pictures.spec.ts` are known to fail on the Dell/laptop identically on main; not chased.
