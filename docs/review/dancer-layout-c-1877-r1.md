# Review r1 (PR #1877, head 7b79c6c82f868abd49b2f4b1f104e2c57b19d867): layout C S3 Sign out at foot of Account settings

Reviewer: Sonnet (independent of the Opus builder). One round, risky class: screens with saves and routing.
Merge dark: every change is behind VITE_ENABLE_DANCER_LAYOUT_C, default off. Findings below are follow-ups
to close BEFORE the flag is turned on in production. None blocks a flag-off merge.

## Verdict: PASS WITH NITS

## Findings
- med: PR body placeholders (Phone QA) must be filled and say the 390x844 walk is unverified.
- low: handover cites #1873, replaced by this PR #1877; PR title should describe the code change.
- low: layoutCFlag.ts is a byte copy of the S1 file; merge S1 first and rebase to drop the duplicate.
- low: DANCER_LAYOUT_C_ENABLED is global; Sign out moves to the page foot for all users when on. Intended per owner decision (Sign out only in Account settings bottom). Check the QuietSignOut tap target has explicit px height at 390x844.
