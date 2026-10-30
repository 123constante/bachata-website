# Handover: P3 journey audit, team group (dt_3475e11a6ff4)

**Done:** `docs/design/p3-acceptance/AUDIT-team.md` covers 36 journeys (J-e1..8, J-f1..4, J-g1..6, J-i1..18) and 83 steps: 41 PASS, 28 FAIL, 14 CANNOT-TELL, with findings A-team-1..29. It was done with code trace, live RPC bodies and prod SELECT counts. Nothing was changed: no edits to `src/` and no writes to prod.

**Left / next steps for the lead:**
1. Fold the contract corrections into CONTRACT.md: G-17 and G-08 are stale, G-31 is resolved, G-35 should be re-scoped to `/invite`, J-g5 expects P0001 not 42501, E19 `already_linked` means something different, and J-g1 cannot be walked as written.
2. Get owner decisions on the questions in the findings tables:
   - R1 retired for page holders?
   - Home shows one page or all?
   - Who may mint invites, and with which role?
   - Grace length.
   - What a second owner is.
   - What happens to live events when the last person leaves.
   - Is a sign-up stub "content"?
   - Does a claim queue exist?
3. Do the 16 browser walks listed in the audit.
4. Fix A-team-1 (blocker) before the flag goes on.
5. Two admin-repo fixes: A-team-11 (W0 contributor kinds) and A-team-27 (last-manager leave).
