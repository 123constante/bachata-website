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

## Left / not done
- `callbackErrorCopy` (`lib/auth-otp-routing.ts`) wording was not shortened (mockup 9b); out of the slice's listed items.
- No 390x844 Playwright walk with seeded fixtures (see PR body, Not verified).
- The Request-access form is inline under the wall message; mockup 3b shows it as its own screen. Visual match not checked.
- `callbackErrorCopy` aside, `used-by-me` relies on the server's `already_member` answer (current members only). A person who used the link and later left sees the plain "already used" screen, by design.

## Next steps
1. Run the 390x844 walk (invite open/used/revoked/expired/mismatch/unproven, wall + request form, code screen).
2. Merge with slice B (`claude/arc1-pr2-sender`) in the orchestrator; no shared files (`adminApi.ts`/`AdminOrganisersPage.tsx` are B's).
3. Once admin PR #912 is on prod, one real-data shape check of the preview RPC (7 existing invite rows).
