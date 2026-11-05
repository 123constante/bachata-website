# Inventory: invited-organiser first batch (slices B, R, U)

Brief: `brief/fix-join-first-batch:docs/briefs/fix-join-first-batch.md`. Base: `main` @ 7748023. Line numbers are
the UNFIXED code unless marked (new).

## Slice B: banner words

| # | Screen / string | File:line (before) | State today | After |
|---|---|---|---|---|
| B1 | Home grace banner title "Finish your details to create and edit events." | `src/modules/organiser/p3/screens/GraceBanner.tsx:66` | shown when left>0, member, not hidden today | `GRACE_BODY` (graceModel.ts, ONE copy): "Finish your details first to create or edit events. It takes about five minutes." |
| B2 | Banner line "N things left. Until then everything works as usual." | `GraceBanner.tsx:67` | FALSE: the gate is ON, writes are refused | "N things left" only (`thingsLeft`) |
| B3 | Gate sheet `GATE_COPY.body` "...It takes about five minutes and you only do it once." | `p3/onboarding/gateModel.ts:12` | true, no "as usual" claim | unchanged |
| B4 | You tab page row / page editor `toFinish` "To finish: N things left" | `graceModel.ts:7`, `organiser/page/index.tsx:36` | true, no "as usual" claim | unchanged |
| B5 | grep `works as usual` over `src/` | only B2 | | 0 hits (the other "as usual" hits are date-copy about a date going ahead, unrelated) |

## Slice R: return to the event

| # | Where | File:line (before) | Today | After |
|---|---|---|---|---|
| R1 | Refused write records its screen path | `p3/onboarding/gate.ts:93-110` (`useGatedCopy`, `GateAsk.at`) | `at` used only to drop asks for another screen | unchanged; now also passed to the sheet (`GateHost.tsx:28`) |
| R2 | Gate sheet Continue | `GateSheet.tsx:33` (`to = view.to`) -> `p3StartReview` (`shell/paths.ts:82`) | `/account/p3/start?o=<id>&at=review` | same + `&back=<event page>` when `at` is a valid P3 event path (`returnTo.ts` `withBack`) |
| R3 | `back` validation | (new) `p3/onboarding/returnTo.ts` | none | only `/account/p3/events/<[A-Za-z0-9_-]{1,64}>[/<word>]` -> that event's page; anything else null (off-site, `//`, `..`, other areas) |
| R4 | Review footer primary "Go to Home" | `OnboardingFlow.tsx:907` (`primaryLabel`), `pageModel.ts:398-403` (`reviewCopy`) | always Home | "Back to your event" + goes there (replace) when back valid AND 0 left; else "Go to Home" |
| R5 | Live screen "Go to Home" (button + back label) | `OnboardingFlow.tsx:988,998` | Home | same rule, left = 0 |
| R6 | "Asked to join" Go to Home | `OnboardingFlow.tsx:332` | Home | unchanged (not a gate path) |
| R7 | Back loop | | | event reached with `replace: true`; the Review entry is not left behind |
| R8 | Replay | | | none: the refused edit is not resent; the person redoes it |

## Slice U: used link

Admin invite tools (`AdminOrganisersPage.tsx`, `InviteRequests.tsx`) show invite status from the same
`organiser_invites` row; unchanged. Website landing: `/invite/:token` -> `InviteRedeemPage.tsx` -> `join/JoinPage.tsx`.

| # | State x viewer | File:line (before) | Today | After |
|---|---|---|---|---|
| U1 | used x signed in, redeemer (redeem `already_member`) | `JoinPage.tsx:86-102`, `joinModel.ts:97` | Done screen + "Open your organiser home" tap | straight to the same target (`doneTarget`, JoinScreens), `replace: true` |
| U2 | used x signed in, on the team, redeem REFUSED first (dancer-profile gate runs before the already_member read on prod) | `joinModel.ts:98` | dead "This link was already used" (live dead end) | own page list matches -> same as U1 |
| U3 | used x signed out | `inviteModel.ts:214` (`REDEEM_COPY.used`) | "This link was already used / If that was not you, ask for a new one." + big Ask button | "You already joined" / "Sign in to continue." + **Sign in** (`/auth?mode=signin&returnTo=/invite/<token>`), Ask for a new one as the smaller (outline) option |
| U4 | used x signed in as someone else | same | same as U3 today | "This link was already used" / "This account is not on the team. If you joined with a different account, sign in with that one. If not, ask for a new one." + **Sign in with a different account** (signs out, stays on the link) + smaller Ask. Never names who used it |
| U5-U7 | expired / revoked / invalid x every viewer | `inviteModel.ts:213,215,216` | terminal dead screen | unchanged |

## Server answer (read-only, prod, 2026-11-03)

`redeem_organiser_invite_v1`: after the auth/account checks and `_require_complete_dancer_profile_v1()`, a CURRENT
`entity_members` row for the caller on the invite's organiser returns `{ok:true,status:'already_member',organiser_id}`
BEFORE any used/expired check. That is caller-scoped (auth.uid()), so it never says who used a link to anyone
else. `organiser_invite_preview_v1` returns `status` only. So: no DB change needed; built client-side (U1 server,
U2 the person's own page list, which is also caller-scoped). The profile gate running first is why U2 exists.

## Coverage count

Banner: 5 counts x 2 roles x 2 hidden = 20/20. Return: 5 surfaces x 4 returnTo = 20/20 (+6 hostile paths) and
3 checklist x 3 back = 9/9. Used link: 4 states x 4 viewers = 16/16. **Total 65/65 states covered by tests.**
