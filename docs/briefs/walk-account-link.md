# BRIEF: 390x844 walk of the account-link screens (Website)

Lane: normal. Branch: claude/walk-account-link. Repo: 123constante/bachata-website. Context cap 40%.

## Goal
Owner asked for a walk of the account-link screens. Prod flag buyer_account_link is now ON and the code email already arrived for the owner. Walk the UI and fix small nits in ONE PR.

## Where
- src/modules/dancer-app/screens/tickets/AccountLinkPanel.tsx (shown from TicketsScreen.tsx)
- src/modules/dancer-app/api/accountLink.ts (RPC wrappers, read only for the walk)
- src/pages/Account.tsx, src/modules/dancer-app/gate/AllowedRedirect.tsx
- Backend: supabase/migrations/20270323070000_account_link_v1.sql in the admin repo (read only).

## Steps
1. Run mocked: stub the account-link RPCs in the browser (route mocks), never prod writes, no real sign-in. Run on the Acer/Dell test host only, not on this PC.
2. At 390x844 walk: panel closed, request step (email entry), code step (6 digits, wrong code, expired code, too many tries), success, already-linked, flag-off hidden.
3. Measure and report numbers: taps under 44px, sideways scroll, text contrast under 4.5, console/page errors, copy clarity (plain, warm, British English, no pointing at missing controls).
4. Fix small nits (max 3 files / 80 lines) in the same PR with a test; park bigger ones as a list in the PR body.

## Rules
- Push only claude/walk-account-link. Never merge or approve. Never --no-verify.
- Bot-authored PR. Supabase read-only. No passwords or sign-in pages; mocked data only.
- Do not change the DB flag or edge function. Out of scope: money, prod deletes, secrets.
- Finish with a Verified / Not verified block and one-line report.
