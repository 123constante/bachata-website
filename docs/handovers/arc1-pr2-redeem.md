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

## Fix pass (dt_62409c108d47): review `docs/review/arc1-pr2-review.md` F1-F5, F9

Merged `origin/main` (817a4dd) into the branch and resolved per the review's "Resolution":
- **One copy map (F2).** `REDEEM_COPY` holds each reason once, at the approved mockup wording.
  Main's second `email_unproven` / `email_mismatch` keys and `emailMismatchCopy` are gone.
  `redeemMismatch.ts` is deleted: `interpretRedeemWithMismatch` folded into `interpretRedeem` +
  `reasonScreen` (one mapping). A test pins that each key appears once in `inviteModel.ts`.
- **One preview fetcher/parser (F4).** `invitePreview.ts` is deleted. `inviteRedeemApi.fetchInvitePreview`
  (through `adminApi.previewOrganiserInvite`) + `inviteModel.parsePreview`. `safeEmailHint` now lives in
  `inviteModel.ts` and guards the preview `email_hint`, redeem's `invite_email_hint` AND `reasonScreen`'s
  hint. A full address shows nothing and does not mark the link bound.
  `parsePreview` treats the pre-arc-1 shape `{email_hint, organiser_name}` (no `status`) as open.
- **Sign-out escape (F1).** New `RedeemAction` `switch_account` for 2d/2e. `SwitchAccount` in
  `InviteRedeemPage.tsx`: the shared `signOut`, then this invite's `/auth` (no loop). 2e first sends
  the sign-in code to the signed-in address (`sendInviteSignInEmail`, `shouldCreateUser:false`,
  returnTo = the invite), then signs out and seeds the code step so `/auth` opens on the code box.
  A failed send or sign-out stays on the screen and says so. Main's 1a masked-hint line is kept.
- **Copy (F3).** 2a-2f, 3b/3c (`RequestAccess` title/line/button, 3c "Back to Bachata Calendar"),
  4a "Send a new code in Ns", 9b `callbackErrorCopy('expired')` + "Send a new link" button on /auth.
  Table test `mockupCopy.test.ts` (one row per mockup line).
- **Wrong vs run out (F5).** No GoTrue error code is trusted. `MagicLinkConfirmation` keeps the send
  time (stored code step, reset on resend) and calls a code run out only past
  `OTP_LIFETIME_SECONDS` (3600, the hosted default) in `auth-otp-routing.ts`. Inside that, every refused
  code counts a try. Tested with both error shapes (`code: otp_expired` and message-only), inside and past
  the lifetime.
- **F9.** No raw ellipsis in `RequestAccess.tsx`; the disabled Request access button says why.
- Red-first: the new rows ran against the old head 4bd9430: 28 of 51 failed.
- `invitePrefill.ts` unchanged (PR 3 integrates prefill).

## Left / next steps
- **No preview = plain flow.** Prod's `organiser_invite_preview_v1` is still the OLD body: it answers `{}`
  for used, revoked and expired links (surveyed 2026-10-21). `{}` therefore no longer means "garbled". The
  page shows the plain sign-in / Join card, and redeem's answer decides the screen (2f for `invalid`, with
  no ask button). So PR 1 and this PR can deploy in either order. Before PR 1 lands, the pre-sign-in 2a-2c
  screens appear only after Join.
- Updated `tests/e2e-build` (code copy, 3-try lock, 9b "run out" / "Send a new link").
- `OTP_LIFETIME_SECONDS` is not checked against the project's Auth setting (the dashboard is not readable
  from here). If the owner's setting differs, change that one constant.
- One wrong code and one expired code against real Supabase Auth: not done. This needs a real mailbox.
- F6-F8 belong to #930 (sender), not this branch.
