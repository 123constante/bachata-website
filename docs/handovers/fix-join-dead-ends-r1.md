# Handover: fix-join-dead-ends-r1

## Inventory (step 1)
Dead-link states in `DeadScreen` (JoinScreens.tsx): used/signed-out, used/other-account, used/auth-resolving (no viewer yet), expired, revoked, invalid (unknown or malformed link). Join card: `OrgCard` (one use of `JOIN_COPY.join.card`). Code error: `JoinPage.tsx` verify handler. 6 dead states + 1 card + 1 code message = 8 states, 8 handled or explicitly stopped, none omitted.

## Fixes
1. Row 07: ALREADY on main (#1291): signed-out used link shows "You already joined" + "Sign in" (`invite-used-sign-in`, returnTo `/invite/<token>` via `buildSignInHref`). No change. Only the transient auth-resolving moment shows no button (deliberate; avoids flashing the wrong one).
2. Row 08: unknown link now has "Ask for a new link" (`JOIN_COPY.unknownLink`), a link to the existing sign-up WhatsApp help route. `request_new_invite_v1` needs a real token, so it cannot serve this state.
3. Row 12: STOPPED, nothing changed. `classifyVerifyError` maps both to `wrong_code` because Supabase's verifyOtp answers one message ("Token has expired or is invalid") for wrong and expired codes. The client cannot tell them apart.
4. Row 16: card now "Join X's team. You'll finish a few details about you and the page, then you can add and edit events." (`JOIN_COPY.join.card`, one string).

## Evidence
- Red first: `deadEnds.table.test.tsx` on unfixed code: 3 failed (08 unknown link control, 08 wording, 16 card), 3 passed (07 and the existing states).
- Green after: `npx vitest run src/modules/admin-organisers`: 30 files, 869 tests pass. Updated `joinCopyRoughEdges` (card wording) and `refusalMatrix` (invalid now carries exactly one help link).
- Bundle: `npm run build` + `check:bundle-budget` on the branch: all budgets respected, dancer-app 47 chunks, allowance 47. Only a few bytes of text changed in the existing join chunk. Not compared against a main build byte for byte.
- `tsc` shows existing errors in Venues.tsx and venuePublicService.ts, untouched by this change.

## Verified / Not verified
Verified: unit matrix above, build and budget. Not verified: the 390x844 route-mocked e2e walk and pictures in docs/walk/fix-join-dead-ends-r1/ (not done), tap-target size check in a browser (the new link uses the shared `BTN`, min-h 48px), real phone, real invite, prod data shapes (no Supabase survey), `pre-ship`, `/code-review`.
