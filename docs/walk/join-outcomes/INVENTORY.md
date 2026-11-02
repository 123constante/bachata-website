# Join outcomes inventory (walk-join-outcomes-r1)

Source: `joinModel.ts` `interpretJoinRedeem` :220-244 (server answer -> outcome kind) and `redeemAction` :257-270 (outcome -> act);
screens in `JoinScreens.tsx` `StopScreen` :235-325, `DeadScreen` :190, `DoneScreen` :164, `WrongAccountScreen` :177; page routing `JoinPage.tsx` :200-202 (applyRedeem), :308 (dead), :359 (wrong_account).
Both entries use the SAME `applyRedeem` (JoinPage.tsx:197): **Join tap** = `join()` :~237 (signed in, `from='join'`); **after sign-in** = `verify()` :~211, person-bound invite whose claim is `no_match`, one redeem (`from='claim'`).

| # | Server answer | Outcome kind (joinModel) | Act (redeemAction) | Screen it must show (file:line) | Walk pictures (join-tap / after-sign-in) |
|---|---|---|---|---|---|
| 1 | redeemed | done | done | DoneScreen JoinScreens.tsx:164 | 01 / 16 |
| 2 | already_member | done (alreadyMember) | done | DoneScreen :164 | 02 / 17 |
| 3 | email_mismatch | wrong_account | stop | WrongAccountScreen :177 (via StopScreen :303) | 03 / 18 |
| 4 | email_unproven | email_unproven | stop | StopScreen :282 | 04 / 19 |
| 5 | not_linked | not_linked | stop | StopScreen :292 (the only "we've told" text) | 05 / 20 |
| 6-9 | used / expired / revoked / invalid | dead | refetch_preview -> step dead | DeadScreen :190 | 06-09 / 21-24 |
| 10 | rate_limited | rate_limited (from join) | stop | StopScreen :251 -> reasonScreen ReasonActions :213 | 10 / 25 |
| 11 | team_full | refused | stop | StopScreen :313 (inviteModel.ts:219) | 11 / 26 |
| 12 | unconfirmed_account | refused | stop | StopScreen :313 (inviteModel.ts:202) | 12 / 27 |
| 13 | profile_incomplete | profile_incomplete | refetch_completion -> About step | JoinPage.tsx:332 (see Not verified) | 13 / 28 |
| 14 | sign_in_required | sign_in | sign_out -> email step | JoinPage.tsx:311 | 14 / 29 |
| 15 | HTTP 500 / unknown | failed | stop network | StopScreen :273 | 15 / 30 |

Not outcomes of redeem but on the path: bind/send rate limit (`rate_limited` from `code`, StopScreen :251-262), `blocked_domain` :242, `already_bound` :305 -- NOT walked (need other RPC answers); "Send my code" bad-shape tested on the email step (31, 32).

**Coverage: 15 redeem outcomes x 2 entries = 30 cases, 30 screenshotted, plus 2 email-step pictures (32 pictures).**
