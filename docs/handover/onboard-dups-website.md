# Handover: buyer duplicate-account linking, Website half (branch claude/onboard-dups-website)

Brief: `brief/onboard-dups-website:docs/briefs/onboard-dups-website.md` (blob b4bee558). Ticket dt_2cbb5ad8e18f.
Flags: build flag `VITE_ENABLE_BUYER_ONBOARDING` (no RPC at all when off) AND the DB flag
`app_feature_flags.buyer_account_link` (false; every RPC answers `error:'disabled'` -> the UI renders nothing). Rollback = either flag off.

## Done (part 2: link UI on My tickets)
- `src/modules/tickets/CodeBoxes.tsx`: the 6-box code entry EXTRACTED from `TicketPickerB1` (checkout now uses it; same behaviour,
  plus one fix: typing over a filled box replaces that digit instead of being read as a paste).
- `src/modules/dancer-app/api/accountLink.ts`: wrappers for `request_account_link_v1`, `confirm_account_link_v1`,
  `my_account_links_v1`, `unlink_account_v1` (via `rpcLoose`; not in types.ts yet), every refusal -> one sentence.
- `src/modules/dancer-app/screens/tickets/AccountLinkPanel.tsx` on `/app/tickets`: quiet link "Have tickets under another email?"
  -> sheet (email -> "Send code" -> neutral "If that email has an account, we've sent a code" -> 6 boxes, auto-check on the 6th).
  Wrong code = red text, boxes cleared, refocus. expired / too_many_attempts / no_pending_request = sentence + "Send a new code".
  Success: "Linked. Tickets from {email} now show here." + My tickets refetch (`useTicketCard().retry`). With one order's card
  in view (`?o=`) the line says "now show on this account" (that card shows one order only). "Linked accounts" list with Unlink + confirm line.
- Shapes read from prod (read-only): all four RPCs + `my_tickets_v1` -> `_my_ticket_buyer_ids_v1` already includes linked users when the flag is on.
- Test: `src/modules/dancer-app/screens/tickets/__tests__/accountLink.test.tsx` (22 rows).
- Walk 390x844 via a throwaway Vite harness (real TicketsScreen + dancer theme, RPCs faked): no horizontal scroll, every tap >= 44px, no page errors.

## NOT done: part 1 (mail sender) -- belongs in the ADMIN repo
The Website repo has no edge functions and no scheduler: every outbox mailer (ticket-email, date-moved-email,
ticket-onboarding-reminder, ...) is a Supabase edge function in the admin repo, triggered by a `pg_cron` job that
`net.http_post`s it with `x-cron-secret` (cron.job, read 2026-11-18). A cron job is schema (admin-owned migration), and this repo
must not add migrations. So, per the brief's "stop and write it in the handover", the sender is specified here for an admin worker:
- Edge function `account-link-mail` (copy `ticket-onboarding-reminder`'s shape + its Resend sender): check `x-cron-secret`;
  service-role `rpc('account_link_mail_claim_v1', { p_limit: 25 })` -> rows `{id, request_id, email, code, expires_at}`;
  per row, send a plain British-English mail ("Your code to link accounts is 123456. It works for 15 minutes. If this was not you,
  ignore this email."), then `rpc('account_link_mail_mark_v1', { p_id: id, p_ok })`. try/catch PER ROW (one bad row never stops the
  batch, never throws); never log `code` or the body.
- Cron migration: `account-link-mail-1m` every minute, same `net.http_post` + `x-cron-secret` pattern. Inert while the flag is off
  (claim returns no rows). Rows left in `sending` by a crash are not retried by the claim (it takes `queued` only) -- admin decision.
- Unit tests for the sender (ok -> mark true, send error -> mark false, one throwing row does not stop the rest).

## Not verified
- No real mail sent (flag off; sender not built here).
- Real signed-in phone session with both flags ON; real link of two accounts end to end.
- e2e suites not run (pre-ship skips them after its repo-only reds). Full unit suite: 17 reds, all live-DB contract / integrity-sandbox tests that fail identically on origin/main here.
- pre-ship typecheck ratchet: 138 vs baseline 106, but origin/main is 138 too (0 added by this branch).

## Next steps
1. Admin worker: build the sender + cron above.
2. Owner: flag ON in a test window, link two own accounts on a phone.

## Status
- PR: #1772 (title per brief; body has Verified on real data + Phone QA; both body checks exit 0). Not merged, not approved.
- tsc run on 76407e0: 0 errors in branch files (tsc -p tsconfig.app.json; 138 repo-wide, same as origin/main).
- Independent review: one /code-review round done in-session (findings fixed: shared isEmail, overtype in code boxes, unlink drops row, order-in-view copy, disabled rows while busy, list height cap). The brief's separate independent review is still to come.
