# Session handover 2026-10-13: surname-hide Website slice

Branch `claude/surname-screens`, PR #746 (head at write time: fe14176, rebased onto main 8821d02 by another worker; #748 with the chunk-cycle fix is already merged to main).
Admin side: PR #794 (`claude/surname-hide-db`), NOT applied to prod.

## Done
- Switch on the own-profile form (`EditProfile` + `HideSurnameSwitch`); untouched save sends nothing; JSON boolean only when changed.
- Every public read of `dancer_profiles.surname/display_name` goes through `get_public_dancer_names_v1` (`src/lib/publicDancerNames.ts`), fails closed to first names when the RPC is absent. Site table: `docs/briefs/surname-screens-handover.md`.
- Tests: `tests/surnameHide.matrix.test.ts` (56, red on unfixed code: 15 failed), `tests/surnameHide.failClosed.test.ts`.
- Other workers added: chunk-cycle fix (also merged to main as #748), console-clean e2e spec, line-up trace (`surname-screens-lineups-handover.md`).
- CI before the rebase: all jobs that ran were green on 59a1a6f / 83e89be. Not re-read after the rebase.

## Open
- Re-read CI on the current head after the rebase (my last full read was before it).
- Not verified: real RPC responses (#794 not applied; prod has no `get_public_dancer_names_v1`), toggle at 390x844 / 360x640, the preview walk (vercel.app blocked from the sandbox).
- DB-side gaps (admin): `get_public_vendor_detail_v1` hands stored `full_name` to anon (0 rows today); DJ stage names win over the mask (3 of 11 contain the surname).
- Follow-up DB migration revoking anon SELECT on surname/display_name, then flip the KNOWN test.

## Next
1. `gh`-less: use the GitHub MCP to read check runs on PR #746's head; fix anything red that is this PR's.
2. After #794 is applied, re-run seo-preview, og-preview, lighthouse; run the console-clean spec against the preview.
3. Never merge; stop after reporting.
