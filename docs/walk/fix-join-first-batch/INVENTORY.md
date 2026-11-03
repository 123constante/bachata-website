# Inventory: PR #1291 (fix-join-first-batch) browser walk, 390x844

Spec: `tests/e2e/walk-fix-join-first-batch.spec.ts` (not in the CI gate list). Pictures: `docs/walk/fix-join-first-batch/<nn>-<state>.png`. Server answers are simulated at the network boundary (OrganiserFake + `page.route`), like `arc1-invite-redeem-walk` and `p3-gate-sheet`.

Run: `VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-fix-join-first-batch.spec.ts --project=chromium`

## (a) Home grace banner (`GraceBanner.tsx`, copy `graceModel.ts:10`)
| # | State | Screen it must show | Code | Picture |
|---|---|---|---|---|
| 01 | 5 things left, not hidden | Banner with GRACE_BODY, "5 things left", one primary "Continue" (href `/account/p3/start?o=<org>&at=review`), "Hide for today" | GraceBanner.tsx:57,63-72; graceModel.ts:10,60 | 01-banner-5-left |
| 02 | hidden for today | No banner, Settings still live | GraceBanner.tsx:44-52,57; graceModel.ts:60 | 02-banner-hidden-today |
| 03 | nothing left (complete) | No banner | graceModel.ts:57 (onboardingLeft=0) | 03-banner-none-complete |
| 04 | status read fails | No banner, Home works | GraceBanner.tsx:12 doc, :57 (s=null) | 04-banner-read-failed |
| - | admin | No banner (`onboardingLeft` 0 for admins). Unit-covered, not walked. | graceModel.ts:57 | none |

## (b) Gate sheet -> Review -> "Back to your event"
| # | State | Screen it must show | Code | Picture |
|---|---|---|---|---|
| 05 | refused write on an event page: sheet | "A few details first", Continue href carries `&back=<event>`, Not now | GateSheet.tsx:38,73-75; returnTo.ts:16 | 05-gate-sheet |
| 06 | tap Continue, items left, valid `back` | Review whose final button is "Go to Home" (NOT Back to your event) | OnboardingFlow.tsx:138-139,916-917; returnTo.ts:26 | 06-review-items-left-with-back |
| 07 | 0 left, `back` = event | "Back to your event"; tap lands on `/account/p3/events/<id>` | returnTo.ts:6,9,26; OnboardingFlow.tsx:139 | 07-review-done-back-valid-event |
| 08 | 0 left, `back` absent | "Go to Home" | returnTo.ts:9 (null) | 08-review-done-back-absent |
| 09 | 0 left, `back` foreign (https://evil...) | "Go to Home" | returnTo.ts:6 (anchored regex) | 09-review-done-back-foreign |
| 10 | 0 left, `back` a non-event path (/account/p3/you) | "Go to Home" | returnTo.ts:6 | 10-review-done-back-non-event-path |
| 11 | 0 left, `back` with a bad id | "Go to Home" | returnTo.ts:6 | 11-review-done-back-bad-id |
| - | Live screen "Back to your event" | `homeLabel={finishLabel(back,0)}` (needs the go-live call). Not walked. | OnboardingFlow.tsx:313 | none |
| - | signed-out Review sign-in carries `back` | `withBack` on the sign-in return. Not walked. | OnboardingFlow.tsx:306 | none |

## (c) `/invite/:token`, used link
| # | State | Screen it must show | Code | Picture |
|---|---|---|---|---|
| 12 | signed out | "You already joined" / "Sign in to continue." + Sign in | JoinPage.tsx:161; JoinScreens.tsx:224; inviteModel.ts:230 | 12-used-signed-out |
| 13 | the redeemer (redeem: already_member) | Replace-navigate to `/account/p3?o=<org>`, their page home, never the link | JoinPage.tsx:103-109,155-161; joinModel.ts:100; JoinScreens.tsx:169 | 13-used-redeemer-lands-home |
| 14 | a different account (redeem: used, no same-name page) | "This link was already used", not on the team, "Sign in with a different account" | JoinPage.tsx:89-93,110-111; JoinScreens.tsx:225; inviteModel.ts:231,322 | 14-used-other-account |
| 15 | redeemer's list has a same-name page, server says used | Same as 14 (server `dead` is final) | JoinPage.tsx:86-93 (usedRefused) | 15-used-same-name-page |

Coverage: 15 states (01-15), 15 screenshotted. Three further rows marked "-" (admin banner, Live screen, signed-out Review sign-in) are NOT walked and not counted.
