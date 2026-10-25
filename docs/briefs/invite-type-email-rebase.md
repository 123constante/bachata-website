# Brief: rebase invite-type-email onto main (Normal lane)

Branch: `claude/invite-type-email` (2 commits, 12 files, 574 lines, never merged; old PR #959 was closed by the PR cleanup, not rejected).
Owner decision 2026-10-25: rebase and reopen.

Do:
1. Rebase the branch onto current origin/main. Resolve conflicts keeping main's behaviour; the feature is the type-your-email step (BindEmailStep) for an unbound organiser invite link plus the DancerProfileGate for self-bound links.
2. Check the invite flow still matches main's invite RPC/API shapes (inviteRedeemApi.ts). Website only: no migration, no supabase/**.
3. Run the affected vitest files (src/modules/admin-organisers/__tests__) and every CI job step that applies; put the per-job table in the PR body with a Verified / Not verified block.
4. Push once; the bot opens the PR. Handover in docs/handovers/invite-type-email.md updated.
Do not merge. Context cap 50%.
