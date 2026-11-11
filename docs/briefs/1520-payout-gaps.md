# Brief: PR #1520 manager payout gaps (branch claude/organiser-area-v2-tickets, lane normal)
Owner decision 2026-11-11: managers lose refund, ALL money amounts and payout setup (owner only). Independent review of head 4de9a894 found it incomplete:
- GetPaid.tsx Prompt (~:248, via GetPaidPrompt/showPrompt) and StartBody (~:352, manager = canManage) still let managers start Stripe onboarding.
- TicketsEntry.tsx ~:166 `onboard` not gated.
Task: gate every payout/onboarding entry point to owner only, with a table-driven test (screen x role: owner/manager/other) from one shared mapping; disabled/hidden controls must say why; no copy pointing at a missing control. No change to RPCs, prices, refunds or payout logic. No raw unicode punctuation in JSX (use entities). Add "## Verified on real data" (Shapes surveyed / Checks run / NOT verified) to the PR body. Push to the same branch once; run the CI table; walk 390x844 if a preview is cheap.
