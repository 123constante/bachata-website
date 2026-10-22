## Summary
Review fix pass on the Arc 1 prefill (F1-F5 of the independent review):
- F1: a prefilled city is checked to exist (`fetchCityExists`) before its question is skipped; unknown or unverifiable -> the question is asked. A save refused because of a prefilled key is retried without it, the dropped question is asked, and what the person saved stays.
- F2: the prefilled first name is shown, editable, on its own step (planDancer4 `defaults`), not saved unseen. Only the city is saved without asking.
- F3: `FinishProfile` reads the prefill keyed on `user?.id` (and derives the draft from edits + prefill), so a late-resolving user still gets it.
- F4: a failed or refused redeem clears the store; `email_mismatch` leaves it untouched.
- F5: `parsePrefill` renamed `parseDancerPrefill` (dancer4Model) and `parseInvitePrefill` (inviteModel).

## Verified on real data
Shapes surveyed: none (no Supabase query run). Prod has no bound invites and `organiser_invites` has no prefill columns yet, so the bound path exists on mocked shapes only. Shapes covered by table-driven tests: valid / unknown / unverifiable city id, prefill refused by the server, genuine offline save failure, failed redeem, refused redeem, email_mismatch, redeemed without prefill, already_member then Home, stale earlier-invite entry, user undefined then defined.
Checks run:
- `npx vitest run dancer4 + admin-organisers + pages` -> exit 0 (1018 pass in pages+admin-organisers; dancer4 suites pass)
- `npx vitest run src/modules/organiser src/modules/admin-organisers src/pages src/lib` -> exit 0 (242 files, 6149 pass, 4 skipped)
- `npm run typecheck` -> 99 errors, none in touched files (baseline 106)
- `npm run build` -> exit 0
- `npx eslint` on touched files -> 0 new errors (pre-existing InviteRedeemPage tokenRef error, FinishProfile fast-refresh warning)
- Red-first: new tests failed on the unfixed branch (17 in dancer4 suites, 4 in the journey suite) before the fix.
NOT verified: the other CI jobs in `.github/workflows` (pre-ship, db-contract checks, integrity / check:images, e2e smoke) were not run locally; real-data shape survey; production data.

## Phone QA
Sizes checked: none (390x844 not walked)
Walked: not walked
Not verified: all visual behaviour; the "Loading..." state while the city is checked is unstyled beyond `text-sm text-muted-foreground`.
