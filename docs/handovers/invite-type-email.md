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
