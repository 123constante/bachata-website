# BRIEF: account-link nits + live 390x844 walk (Website)

Lane: normal. Branch: claude/account-link-nits. Repo: 123constante/bachata-website. Context cap 40%.
Owner click 2026-11-18: fix the 3 parked nits first, then a LIVE walk. The earlier walk (PR 1782) was static only.

## Files
src/modules/dancer-app/screens/tickets/AccountLinkPanel.tsx and its test src/modules/dancer-app/screens/tickets/__tests__/accountLink.test.tsx. Touch nothing else. Do NOT add any .md file under src/ (dancer-area-isolation guard); put the handover in your final report/PR body only.

## Nits (small, plain British English, warm, no pointing at missing controls)
1. Code step: show the email the user typed ("We sent a code to <that email>.") so they can spot a typo. Use only what they typed, never anything from the server (keep the neutral server answer).
2. "Send a new code" (needsNew state): resend to the same email in one tap, no return to the email step. Keep the existing rate-limit/disabled handling.
3. Initial list failure other than 'disabled': do not hide silently; show a small quiet line "Couldn't check your linked accounts." with a "Try again" quiet link (44px min). 'disabled' still hides the panel.

## Live walk (mandatory, Acer/Dell host only, NOT this PC; mocked RPCs via browser route mocks, no prod writes, no sign-in)
Render at 390x844 and report MEASURED numbers: panel closed; email step; code step (wrong code, expired, too many tries); success; already linked; list failure; flag off hidden. For each: taps under 44px, sideways scroll px, text contrast, console/page errors. If you cannot render live, say so under Not verified; do not guess from CSS.

## Rules
- Push only claude/account-link-nits. Never merge or approve. Never --no-verify. Bot-authored PR via `gh pr create` with the bot token (not the MCP create tool). Supabase read-only.
- Max 3 files / 80 lines so it stays tier S. Test each nit. Finish with Verified / Not verified.
