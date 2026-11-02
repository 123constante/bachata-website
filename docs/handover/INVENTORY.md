# INVENTORY: redeem outcomes x join screens (fix-join-outcomes-r1-cont)

Source of outcomes: live body of `redeem_organiser_invite_v1` (pg_proc, prod `stsdtacfauprzrdebmzg`, read-only SELECT 2026-11-01).
Client mapping: `interpretJoinRedeem` (`joinModel.ts:222`) -> `redeemAction` (`joinModel.ts:~250`) -> `applyRedeem` (`JoinPage.tsx:191`), called from the Join tap (`JoinPage.tsx:248`) and the post-sign-in safety stop (`JoinPage.tsx:235`).

| # | Server answer | Client outcome | Action | Screen (JoinScreens.tsx) | Test |
|---|---|---|---|---|---|
| 1 | exception `authentication_required` | sign_in | sign out, clear step | email step | table row `sign_in` |
| 2 | `sign_in_required` (anonymous) | sign_in | sign out | email step | `joinModel.test.ts` |
| 3 | `unconfirmed_account` | refused | stop refused | StopScreen `refused` (:313) | table row `refused` |
| 4 | exception `profile_incomplete` / reason | profile_incomplete | refetch completion | About step | table row |
| 5 | `email_unproven` | email_unproven | stop | StopScreen `email_unproven` (:282) | table + page row |
| 6 | `email_mismatch` (+hint) | wrong_account | stop | StopScreen `wrong_account` (:303) | table + page row |
| 7 | `ok` `already_member` | done | done | DoneScreen (:164) | table row `done` |
| 8 | `rate_limited` | rate_limited | stop | StopScreen `rate_limited` (:251) | table + page row |
| 9 | `invalid` / 10 `used` / 11 `revoked` / 12 `expired` | dead | refetch preview | DeadScreen (:190) | table row `dead` |
| 13 | `team_full` | refused | stop refused | StopScreen `refused` (:313) | page row |
| 14 | `not_linked` (person-bound only; ONLY outcome that writes an attempt row) | not_linked | stop | StopScreen `not_linked` (:292), the only "told" copy | table + page row |
| 15 | `ok` `redeemed` | done | done | DoneScreen | table row |
| - | RPC transport error / unknown | failed | stop network | StopScreen `network` (:273) | table row `failed` |

Coverage: 15 server outcomes, 15 mapped to a screen or action, none silently omitted. (The "refused" bucket carries unconfirmed_account and team_full via their own reason copy.)

## Join page screens
Email step (`EmailStep` :108), Code step (:123), About step, Join step (:153), Done (:164), WrongAccount (:177), Dead (:190), NoProfile (:202), StopScreen kinds (:235): blocked_domain, rate_limited, network, email_unproven, not_linked, wrong_account, already_bound, refused.

## GAPs
- GAP: the admin app invite-issue screen lives in `bachata-admin-11april`, not in this repo; not inventoried here.
- GAP: public invite page `/invite/:token` is this same JoinPage (`InviteRedeemPage.tsx` wraps it); the older redeem copy table (`inviteModel.ts` REDEEM_COPY) still has team_full copy but the join page shows it via `refused`. Not changed.
- GAP: after sign-in, a `rate_limited` stop is tagged `from: 'join'` (same as the Join tap); its retry re-runs the Join tap. Acceptable, not changed.
