# Handover: /invite "type your email" step + self-bound gate (old PR #959)

Brief: `brief/invite-type-email` `docs/briefs/invite-type-email-rebase.md` (sha 64f55cc).
Ticket dt_cb66bb355032, 2026-10-25.

## Outcome: superseded by main, NOT rebased

The old branch head was `224506e4883f96e141504bf97813ff9a56b27501` (2 commits on base `ca75415`;
still reachable from closed PR #959). Rebasing it onto main (`36d3cea`) conflicts in 5 files, and
"keep main's behaviour" leaves nothing of it, because #978 (W1, Option B join) already folded both
halves in:

| #959 piece | Where main has it |
|---|---|
| `BindEmailStep` + `bindEmailModel` (type email, bind, then sign in) | `join/JoinPage.tsx` `send()` calls `bindInviteEmail` before the code is sent; `join/joinModel.ts` has `checkTypedEmail` and `interpretBind` ("ported from #959"); `join/joinApi.ts` `bindInviteEmail` |
| `bindOrganiserInviteEmail` in `inviteRedeemApi.ts` | `join/joinApi.ts` `bindInviteEmail` (same RPC `bind_organiser_invite_email_v1`, `p_token`, `p_email`) |
| Self-bound links go through `DancerProfileGate` | Deliberately reversed: `InviteRedeemPage.tsx` says "No DancerProfileGate here"; the dancer questions are asked inline (`join/AboutStep.tsx`). `join/__tests__/inviteGate.test.tsx` is "Folded from PR #959's inviteSelfBoundGate.test.tsx (superseded by W1)" and asserts the gate NEVER redirects /invite |
| `InvitePreview.selfBound` parse | Not needed on main: nothing branches on it now that the gate never applies to /invite |

Re-applying the branch would add `BindEmailStep.tsx` with no importer (main's `InviteRedeemPage`
renders only `JoinPage`) and a gate rule that the main test suite forbids. So main was merged in
taking main's side for every file (history kept, no force-push); this note is the only diff vs main.

## Verified
- `npx vitest run src/modules/admin-organisers` on main: 22 files, 622 tests pass.
- Conflicts reproduced locally (`InviteRedeemPage.tsx`, `invitePreview.test.tsx`,
  `inviteReasons.test.tsx`, `routes.matrix.test.tsx`; `inviteWalkthrough.test.tsx` deleted on main).

## Not verified
- No browser walk (no code change). No prod shape survey (no code change).

## Left / next
- Owner: close this out; nothing to reopen. If a #959 behaviour is still wanted, it is a fresh
  design question against W1 (`join/`), not a rebase.
