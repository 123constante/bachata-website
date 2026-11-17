# Fix round 1: PR #1745 post-pay teaser (branch feat/ticket-teaser-readonly)
Read docs/handover/ticket-teaser-readonly.md on the branch first. Flag stays default OFF.
1. CI `bundle-budget` is red on vendor-supabase (+15 KB vs baseline 43 KB). First check if origin/main is red too (rebase onto latest main first). If main is green and this branch causes it, remove the cause (the teaser must not pull extra supabase code into first load: lazy-load the teaser screens). If main is also red, say so in the PR and leave it.
2. Continue on the lock sheet goes to /app/welcome, which the gate sends a view-only buyer to /account. Make the gate admit /app/welcome for a view-only buyer ONLY when the teaser flag is on, so Continue reaches onboarding. Add a test. Do not change onboarding itself.
3. Home greeting "Hi there": if the buyer's first name is available without a member RPC (auth user metadata), show it; else keep "Hi there".
4. Walk the real signed-in shell at 390x844 if a view-only buyer account can be reached read-only; otherwise state not verified. Update the PR body "Verified on real data" block.
Push once, handover update, PARTIAL marker rules as usual.
