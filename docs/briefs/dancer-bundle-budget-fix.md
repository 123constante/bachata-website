# Fix bundle-budget red on PR #1576 (branch claude/profile-dash-dancer-build1)
Lane: normal. Same branch, one push.

## Failure (quote)
`bundle-budget` red at head c7cfeb11: tracked chunk "vendor-supabase" 57.3 KB gz vs baseline 43 KB (+14.3 KB). Route budgets ok; dancer-app 374.3 vs 376.
Likely cause: the c7cfeb11 pins of /src/lib/claimMyDancerProfile.ts and /src/lib/myPersona.ts into LIB_EVENT_RULES_MODULES (vite.chunks.ts ~line 375) pulled the supabase client across a false import edge (see the header comment in vite.chunks.ts; vendor-react carries tslib: do not move it).

## Do
1. Reproduce locally: build, run the bundle-budget script (see .github/workflows for the exact step), confirm vendor-supabase size at head and at main.
2. Fix the class: place the two modules in a chunk that already carries the supabase client, or remove the pin and fix the original dancer-app 48-vs-47 chunk ratchet another way. Both vendor-supabase and the chunk-count ratchet must pass.
3. Do not touch contract-check (red on main, prod data drift, not branch-caused).
4. Add/adjust a check only if the existing guard did not explain the failure.
5. Put the per-job CI table and a Verified / Not verified block in the PR body. Push once, handover note in docs/handovers.
