-- Pinned copy of the allowlists in admin PR #820 (claude/account-system-db),
-- migrations 20261122190000 (table CHECKs) + 20261122330000 (writer, landing-only state ids).
-- trackAuthStep.contract.test.ts fails if src/lib/trackAuthStep.ts drifts from these lists.
-- Re-pin when admin changes them.
CONSTRAINT auth_funnel_daily_step_chk CHECK (step IN ('auth_view', 'code_sent', 'code_ok', 'code_fail',
    'callback', 'landing', 'onboarding_end', 'invite_redeem', 'claim', 'join_redeem')),
CONSTRAINT auth_funnel_daily_outcome_chk CHECK (outcome IN ('ok', 'wrong', 'expired', 'timeout',
    'fallback', 'refused', 'error') OR (step = 'landing' AND outcome ~ '^S-[A-Z0-9-]{1,20}$')),
