# join-gaps-2 inventory (items 5 to 8)

Proof first (read-only SELECT on prod, 2026-11-04):
- `request_new_invite_v1(token)`: validates token, refuses `already_requested` (an unhandled row exists) or `rate_limited` (3 in 24h), else INSERTs one row into `organiser_invite_requests`. No trigger on that table, no email or inviter notification, no email asked (the function takes only the token). Table has 0 rows ever, so no observable answer time. The admin sees it in `InviteRequests.tsx` ("Send a new link"). So "We have told {inviter}" and "we will email you" are NOT true; copy says the Bachata Calendar team has it, we cannot say when, WhatsApp for faster.
- Preview (`organiser_invite_preview_v1`) returns status only (`revoked`); `revoked_by`/`revoked_at` exist but are not exposed and carry no reason. Copy must not guess why.
- Item 7: the join screen has no rows-left value; the checklist count is read later by the gate. The Done rule is keyed on rows left and defaults to the details-first sentence when unknown.

| # | Where | file:line | String / rule | Change |
|---|---|---|---|---|
| 5 | site banner hide rule | src/lib/profileCompletion.ts `BANNER_HIDDEN_ON` | "Finish your profile" | hidden on `/invite/*` (zero new bytes, pure function in existing chunk) |
| 5 | About step button | join/JoinScreens.tsx / joinCopy.ts `about.button` | "Continue" | left as is: the one button |
| 6 | label | inviteModel.ts `newLinkLabel` | "Ask {inviter} for a new one" | left as is (button label only; lead may rename, because the request goes to the team) |
| 6 | result | inviteModel.ts `newLinkResultCopy` | "Request sent. The admin will..." | `NEW_LINK_SENT_COPY` / `NEW_LINK_ALREADY_COPY` + WhatsApp button |
| 6 | UI | join/JoinPage.tsx `NewLinkRequest` | status line only | adds WhatsApp button after ok |
| 6 | admin side | InviteRequests.tsx:85 | "Send a new link" | left as is (admin repo owns channel) |
| 7 | Done body | joinCopy.ts `done.body` / JoinScreens.tsx `DoneScreen` | "Everything on its page is yours to use" | `doneBody(rowsLeft)`: only 0 gets it; else `bodyDetailsFirst`; `bodyOff` (flag OFF) left as is |
| 8 | revoked body | inviteModel.ts `REDEEM_COPY.revoked` | '' | `REVOKED_BODY` |
| 8 | revoked screen | join/JoinScreens.tsx `DeadScreen` | ask button only | + WhatsApp button |
| 8 | sender side | senderModel.ts:31 | "The last link was withdrawn." | left as is (admin view, already neutral) |
| 8 | legacy page | InviteRedeemPage.tsx | renders `JoinPage` | same strings, one render path under both flags |

Coverage: 11 rows found, 11 covered by a change or a "left as is" reason, none omitted.
