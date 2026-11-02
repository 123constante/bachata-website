# Walk: About step first-name help line (PR #1274), 390x844

Spec: `tests/e2e/walk-join-firstname-help.spec.ts` (not in the CI gate; run `npx playwright test tests/e2e/walk-join-firstname-help.spec.ts --project=chromium`).
Server answers are mocked at the network boundary (invite preview, claim, profile completeness); no `src/` file changed; no prod access, no sign-in, no real invite tokens.
Each picture is the real About step reached through the email-code path (invite page, then the code step, then About).

Help text expected: "Your own first name, not the page name."

| # | Invite | First-name state | Input value | Help visible, unclipped (in viewport) | Sideways scroll | Help contrast (needs 4.5) | Input height px | Continue height px | aria-describedby resolves | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | Cumbaye (page) | empty | "" | yes | no | 8.19 | 48 | 48 | yes | pass |
| 02 | Cumbaye (page) | typed | "Ana" | yes | no | 8.19 | 48 | 48 | yes | pass |
| 03 | Cumbaye (page) | linked-prefilled | "Ana" | yes | no | 8.19 | 48 | 48 | yes | pass |
| 04 | Daniel Rivera (person-bound) | empty | "" | yes | no | 8.19 | 48 | 48 | yes | pass |
| 05 | Daniel Rivera (person-bound) | typed | "Ana" | yes | no | 8.19 | 48 | 48 | yes | pass |
| 06 | Daniel Rivera (person-bound) | linked-prefilled | "Ana" | yes | no | 8.19 | 48 | 48 | yes | pass |

Every row also asserts: help text equals the fixed line exactly, and contains neither the page name ("Cumbaye" / "Daniel Rivera") nor "Maria". Pictures: `01`..`06` `*.png` in this folder.

## Unit tests
`npx vitest run src/modules/admin-organisers/join`: 7 files, 335 tests, all passed.

## Verified
- All 6 cells (page invite "Cumbaye" and person-bound invite "Daniel Rivera" x first name empty / typed / linked with prefill) pass every measurement above at 390x844.
- Help line sits directly under the input, wraps within the screen, same wording in every cell.

## Notes / Not verified
- Person-bound invites only reach About after the claim links the profile (an unlinked claim is the `not_linked` safety stop, seen when first tried). So rows 04-05 use a linked profile with no prefill; the "linked" note shows in them. Only the page invite (01, 02) is walked with an unlinked profile.
- Continue is below the fold at 844px tall in these pictures (the form also asks city, role, photo); its height was measured, but its being on screen was not required. Contrast is measured from computed colours against the nearest opaque background.
- The spec injects test-only CSS to stop the page's fade-in animation (a frozen test clock left it at opacity 0 in the first screenshots).
- Not verified: real invite tokens or real prod data (not used by instruction); real devices; screen-reader announcement (only the aria-describedby link was checked).
