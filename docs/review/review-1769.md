## Verdict: PASS WITH NITS

## Hard-tier: PASS

Review of PR #1769 (buyer onboarding slice B), branch `claude/onboard-b` at 71d0597 (code head 4d629fd). Findings are from reading code; I did not run the full test suite.

Not verified: the admin migration file `20261117214202_set_my_buyer_roles_v1.sql` was unreachable. This session can read only the website repo. I instead read the LIVE function definition from prod with a read-only `pg_proc` SELECT, which is stronger evidence for the signature and error codes.

## Findings

1. **DB contract: OK.**
   - `src/modules/dancer-app/api/rpc.ts:33` sends `set_my_buyer_roles_v1`, and the `setMyBuyerRoles` call (`rpc.ts:214`) passes `{ p_roles: roles }`.
   - Live prod signature is `set_my_buyer_roles_v1(p_roles text[]) RETURNS text[]`, SECURITY DEFINER, `search_path=public`.
   - Prod grants: `authenticated` has EXECUTE, `anon` does not.
   - Live error messages are `not_signed_in` (42501), `invalid_roles` / `too_many_roles` / `unknown_role` (22023) and `no_profile` (P0002).
   - `errors.ts` maps them: `not_signed_in` and `no_profile` already existed, and the three new codes are added in COPY, FIELD and `DANCER_ERROR_CODES` (`types.ts`). `codeFromMessage` matches the message as a whole word, so all five resolve.
   - Role vocabulary `dancer, organiser, teacher, dj` matches the SQL `c_allowed` and its order. `saveMyBuyerRoles` sends at most 4 and sorts to server order.
2. **Privacy: OK.**
   - `buyer_roles` is read only through `parseMyDancerEdit`, i.e. `my_dancer_edit_v1` (own row).
   - A grep of `src`, excluding tests, shows no `dancer_profiles` select, no public or anon query and no use of the field outside the `dancer-app` module.
   - `roleStep.tsx` and `profileSheet.tsx` have no localStorage, console or analytics calls.
   - Roles are not placed in any URL. The organiser card links to the constant `ORGANISER_HOME_PATH`.
   - The only logging is the existing `unknownValue('buyer_roles', r)` in `rpc.ts`, which logs unknown values from the server and not a user's picks.
3. **Write-door guard: OK.**
   - `scripts/onboarding-write-doors.json:43-46` registers the RPC under `not_event_writes` with a reason.
   - `node scripts/check-onboarding-write-doors.mjs` on this branch reports "Part A: 1381 files, 8 door call(s) in 4 wrapper(s), 0 violation(s)", plus one unrelated expected-pending WARN.
   - `gateRpc.ts:17` adds `setMyBuyerRoles` to the `DancerBackend` type.
4. **Flag OFF and view-only: OK.**
   - `profileSheet.tsx` computes `own = BUYER_ONBOARDING_ENABLED && !viewOnly ? person : null`. With the flag off or a view-only person, `person` is null and `picked` starts as `[]`.
   - With a null `person`, `RoleStep` is not rendered, and the sheet renders the same chips and sub copy as before. The `ROLE_CHIPS` branch and wording are unchanged.
   - `TicketsScreen` reads `sheet.person`, which is null in those cases, so the organiser card never shows.
   - Only `RoleStep` calls `saveMyBuyerRoles`, so a view-only person or the flag-off path never writes.
   - An unchanged set returns `current` and sends nothing (`rpc.ts` `saveMyBuyerRoles`). Skip calls no RPC.
5. **Organiser card: OK.** `showOrganiserCard` (`TicketsScreen.tsx:24`) requires `buyer_roles` to include `organiser` and `other_roles` to lack `organising`. `organising` is the existing vocabulary (`optionsModel.ts:51`, fixtures). The card is a plain `<Link>` to `/account/o`, with no create call, so there is no double create.

## Nits (non-blocking)

- `roleStep.tsx`: after a save error the busy state resets, so the person can retry. There is no distinct handling for `not_signed_in` (the generic copy is shown), which is acceptable.
- `profileSheet.tsx`: the `person` prop is nulled inside the provider while `DancerAppShell.tsx:96` always passes `profile.data`. This is correct but easy to misread, and a comment pointing at the gate would help.
- The admin SQL file itself was not read (see above). The merge gate may want a second check against the admin repo.
