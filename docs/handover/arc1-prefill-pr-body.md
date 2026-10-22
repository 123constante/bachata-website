## Summary
Second fix pass on the Arc 1 prefill (after the F1-F5 review fixes):
- A: a bound link no longer shows the wrong person a plain Join card. The signed-in card says `This invite is for {hint}.` and never "Whoever uses this link joins the team" (that wording stays on unbound links only). When the signed-in email visibly cannot be the bound one (`hintMatchesEmail`: first character and domain of the masked hint, case-insensitive), the card is "This link is for a different email", with `Sign in with that email` (sign out, then sign in) and `Go to Bachata Calendar`, and no Join. The server stays the authority: matching masks still Join, and the after-click refusal path is unchanged and tested.
- B: an open link for a page the signed-in person already manages shows "You are already on {name}" and `Go to {name}` (Home), with no Join and no join spent. Detected from the person's own organiser list (`organiser_home_v1`, same query key Home uses), matched by name (trim, case-insensitive), no new server call. The card waits at most 1.5 s for the list; a failing or slow list keeps today's Join card (the server still answers already_member on click). A name match can only mis-hide Join for two pages with the same name; the server remains the authority.
- C: `Dancer4Flow` city check uses `networkMode: 'always'` plus a 3 s fallback after which the prefilled city is dropped and the city question is asked. The first verdict is latched, so a late answer never changes the prefill under a question the person is typing in.
- Cleanup: dead `parseDancerPrefill` and its tests removed (no importers).
Not changed: the masked hint format (D), the photo step.

## Verified on real data
Shapes surveyed: none (no Supabase query run). The bound path has no production invites yet, so it is covered on table-driven shapes only: mask styles (`x...@d`, `x***@d`), case, plus-addressing, domain differs, first letter differs, null hint, null email; organiser list = owner of that page / member of a similar-named page / empty / failing / never resolving; city check = never resolves / rejects / resolves late / resolves in time true and false.
Checks run (sandbox, CI is not paid GitHub):
- `npx vitest run src/modules/admin-organisers src/modules/organiser` -> exit 0 (162 files, 4252 pass, 2 skipped)
- `npx vitest run src/modules/admin-organisers src/modules/organiser src/lib` before the final B copy change -> only the then-new B test failed; fixed, rerun above is green
- `npx tsc --noEmit -p tsconfig.app.json` -> no errors in touched files (pre-existing errors elsewhere)
- `npm run build` -> exit 0
- `npx eslint` on touched dirs -> only the pre-existing InviteRedeemPage `tokenRef` refs error (baseline had it)
- Red-first: with the source files stashed, the new tests failed on the old head (4 in inviteReasons A/B, 2 in Dancer4Flow C; model tests fail on the missing functions).
NOT verified: the other CI jobs in `.github/workflows` (pre-ship, db-contract checks, integrity / check:images, e2e smoke, `npm run lint` chain) were not run in the sandbox; no real-data survey; no production data.

## Phone QA
Sizes checked: none (390x844 not walked)
Walked: not walked
Not verified: all visual behaviour of the three new cards (different-email, already-on, Loading fallback), and the 1.5 s skeleton before the signed-in card.
