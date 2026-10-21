# Arc 1 PR 2, slice A (redeem): handover

Branch `claude/arc1-pr2-redeem`, ticket dt_699a50fbb273. Brief: admin repo `docs/briefs/arc1/arc1-pr2-invite-sender.md` + `arc1-as-built.md`.

## Done
- `inviteModel.ts`: `REDEEM_COPY` gained `email_mismatch` + `email_unproven`; ONE mapping `reasonScreen(reason, ctx)` used by the pre-sign-in preview screen and the post-Join refusal screen; `parsePreview`, `parsePrefill`, `newLinkResultCopy`, `accessResultCopy`; `interpretRedeem` now returns `prefill` and `emailHint`.
- `inviteRedeemApi.ts` (new, so slice B's `adminApi.ts` is untouched): preview, `request_new_invite_v1`, `request_signup_access_v1` wrappers.
- `InviteRedeemPage.tsx`: preview on load (names page + inviter, screen 2a); broken links (used/revoked/expired) get "Ask <name> for a new one" / "Request a new link"; garbled/unknown links get no ask button; used link opened by a current member goes Home (server answers `already_member`); wrong email screen (masked hint); email_unproven screen. Bound links (preview has `email_hint`) skip the client dancer gate so redeem runs first and `prefill` can be stored; every other link keeps the gate (order unchanged).
- Prefill: `lib/invitePrefill.ts` (sessionStorage, cleared at sign-out and on profile save), read by `FinishProfile.tsx` as the initial draft (first name, city).
- Invite-only wall: `components/auth/RequestAccess.tsx` mounted under the wall in `Auth.tsx`.
- Code screen (`MagicLinkConfirmation.tsx`): wrong vs expired wording, "N tries left", soft limit 3 (`MAX_WRONG_CODES`), "Send a new code" primary and enabled at once after expiry or lock. 8 digits + auto-submit were already in place.
- Tests: `inviteReasons.test.tsx` (reason x screen table, ask flow, member-to-Home, prefill), `RequestAccess.test.tsx`, `AuthCodeStep.test.tsx` updated. Red-first confirmed for the code-screen tests against the unchanged component.

## Continuation (dt_1894faa29c0f)
- `callbackErrorCopy` shortened (all four reasons, <= 80 chars each); table-driven test written red-first (4 red before the change).
- Request access is its own full screen: the wall shows one button; it opens a portalled full-screen view (title, form, Back, sent state). Portal because the wall sits in an animated (transformed) card that trapped `fixed`.
- `tests/e2e/arc1-invite-redeem-walk.spec.ts`: 9 specs at 390x844 on seeded fixtures (open/used/revoked/expired/unknown, mismatch/unproven after Join, wall + request form + sent, code screen wrong code). Screenshots in `docs/handovers/arc1-pr2-screens/`. Not added to the `test:e2e` gate list.
- Fixed `tests/client/authPage.test.tsx` (asserted the old "wrong or has expired" wording).
- The admin brief branch and mockups 9b/3b are in `bachata-admin`, not reachable from this session. Copy and the request screen follow the handover text, NOT the mockups: compare screenshots 09/10/12 and the copy against 9b/3b.

## Left / not done
- Visual check against mockups 9b and 3b (see above).
- `check:integrity` as an npm script fails with Permission denied (exec bit); run via `bash bin/check-integrity.sh` it passes.
- Real-data shape check of the preview RPC (needs admin PR #912 on prod).
- `used-by-me` relies on the server `already_member` answer (current members only); a person who used the link and later left sees the plain "already used" screen, by design.
