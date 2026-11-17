# Brief: independent review of PR #1769 (Website, buyer onboarding slice B). Review only, write ONE docs file.

Target: 123constante/bachata-website PR #1769, branch claude/onboard-b at head 71d0597a4 (code head 4d629fd). Handover: docs/handover/onboard-b-slice-b.md on that branch. Flag VITE_ENABLE_BUYER_ONBOARDING is OFF by default.

Risky classes only: DB contract, privacy, guards. Check:
1. src/modules/dancer-app/api/rpc.ts saveMyBuyerRoles calls set_my_buyer_roles_v1(p_roles text[]) with the exact live signature (prod: SECURITY DEFINER, EXECUTE authenticated). Error codes handled match the SQL: not_signed_in 42501, invalid_roles/too_many_roles/unknown_role 22023, no_profile P0002. Read the SQL on origin/main of 123constante/bachata-admin file supabase/migrations/20261117214202_set_my_buyer_roles_v1.sql (git show via a fetch, or ask nothing: if unreachable say so).
2. Roles are read only from my_dancer_edit_v1 (own row); no public/anon query, no select on dancer_profiles.buyer_roles, no roles in any URL, log, analytics or localStorage.
3. scripts/onboarding-write-doors.json and gateRpc.ts: the new write door is registered correctly and the guard that reads it still passes (run the guard script named in the repo if cheap).
4. Flag OFF = no behaviour change: shell, profileSheet and TicketsScreen render exactly as before; flag ON + view-only person never writes.
5. The organiser link card routes to the existing /account/o flow only when Organiser picked and other_roles lacks organising; no double create.
Do not review style. Findings proved by reading code, not by guess. Do not run the full test suite.

Output: docs/review/review-1769.md on branch claude/review-onboard-b-1769 with first line verdict PASS | PASS WITH NITS | BLOCK, then findings as file:line + reason, then a line "## Hard-tier: PASS|FAIL" with one sentence. Push once. Never merge or approve.
