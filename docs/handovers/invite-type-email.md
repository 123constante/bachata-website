# Handover: /invite "type your email" step (job F, Website half)

Brief: bachata-admin `docs/briefs/auto-join/web-invite-email.md` (sha 57b6268).
**Needs admin PR #952 applied first** (`bind_organiser_invite_email_v1`). Until then the step answers "This isn't available yet. Please try again later." and offers the plain sign-in.

## Done
- `bindEmailModel.ts`: one copy map (`bindCopy`), typed-email check (trim, printable ASCII only), mask, `interpretBind` (function-missing -> unavailable).
- `BindEmailStep.tsx`: type -> confirm ("We'll send your sign-in link to a***@x.com. Is that right?") -> RPC from the browser (anon key, never server) -> sign-in returning to `/invite/<token>`. Never redeems.
- `InviteRedeemPage.tsx`: signed-out + open + unbound preview shows the step. Everything else unchanged; redeem still runs only from the Join button click.
- Tests: `bindEmailStep.test.tsx` (statuses x viewers, zero-redeem-until-click); four older tests updated for the new signed-out unbound screen.

## Notes
- The route is `/invite/:token` (path param), not `?token=`; kept as is.
- Preview with a full/garbled hint counts as unbound, so it also gets the step.
- Pre-existing eslint error in InviteRedeemPage (`react-hooks/refs`, tokenRef) is not from this change.

## Left
Phone walk at 390x844 and a wider size once #952 is applied; owner applies the migration.

## Continuation 2026-10-22: self-bound gate

**Done.** `InvitePreview.selfBound` (`r.self_bound === true`); `InviteRedeemPage` skips DancerProfileGate only for an admin-bound link (`emailHint != null && selfBound !== true`). Self-bound and unbound links finish the dancer profile first. Redeem is still only from the Join click.
Tests: parser table (true/false/absent/null/"true") in `invitePreview.test.tsx`; `inviteSelfBoundGate.test.tsx` (unbound / admin-bound / self-bound / key-absent x profile complete / incomplete, signed in, no redeem without Join). All 430 admin-organisers tests, `tsc --noEmit` and eslint on the folder pass.
**Left.** PR body edit (Self-bound paragraph); admin #956 must be applied before the path is live.
**Not verified.** The self-bound path cannot be walked on prod until #956 is applied. No browser walk, and the CI job steps were not all run locally.
