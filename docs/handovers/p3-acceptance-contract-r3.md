# Handover: P3 acceptance contract, round 3 (dt_f71db19f296b, 2026-10-30)

Branch `claude/p3-acceptance-contract-3`, built on `claude/p3-acceptance-contract-2`. Docs only: no `src/` change, no prod writes (Supabase SELECT only, counts only).

## Done
- `PEOPLE-INVENTORY.md` (new): section 1 = every table holding a person or profile, with prod counts (rows, account link, email, hidden/merged, source) and facts D1-D8; section 2 = every entry path that touches an existing row (E19-E26 plus E10, E11, vendor, sign-up stub), file:line, and code facts C1-C5.
- `INVENTORY.md`: E19-E26 added. 73 rows.
- `CONTRACT.md`: round 3 section, journeys J-i1..J-i18 (listed with same / other / variant / no email, "Already listed?" answers, ambiguous, existing account, code vs link, two accounts, two claimants, already claimed, impostor, three roles, archived/merged, legacy team member, owner adds listed person, unlinkable invite, deleted/banned/venue contact). Gaps G-28..G-41. R4 now puts this class as P1 beside the gate (J-i1, J-i2, J-i4, J-i8, J-i10, J-i12, J-i13, J-i15).
- Coverage: **73 rows, 73 covered, 0 uncovered** (checked by script).
- `ACCOUNTS.md` section 6: seed specs for every J-i journey.

## Key findings for the lead
- **G-28 (High, P1):** matching is by proven email only, and only 3 listed teacher/DJ persons have an email; 132 listed teachers/DJs have no account and no in-app way to claim.
- **G-35 (High, P1):** typed-code sign-in skips the deletion check and "Already listed?" that the link path runs.
- **G-39 (High, P1):** 49 active legacy team rows belong to people with no account; legacy team and P3 `entity_members` have no mapping at join.
- **G-30 (High, data):** 5 teacher claims pending up to 323 days, pointing at ids that no longer exist.
- **G-32 (decision):** the yes / no / not sure answers on "Already listed?" do not exist.

## Not verified
- Server-side matching rules (case-insensitivity, live-only, already-claimed behaviour) come from client comments; the SQL lives in the admin repo and was not read (G-31).
- No accounts seeded, no browser walk; every Pass/Fail line is blank on purpose.
- Code map was gathered by a read-only sweep; E20, E21 and E26 ordering were spot-checked by hand (`auth-otp-routing.ts:316`, `AuthCallback.tsx:197-238`), the rest were not.

## Next steps
1. Owner: decide G-32 (three answers) and G-34 (two accounts: admin join or in-app).
2. Lead: seed ACCOUNTS.md section 6; read the claim RPC bodies in the admin repo to settle G-31 / G-37 / G-38.
3. Walker: R4 slot (1) = J-e8 then the J-i P1 list, then J-x2, then J-g / J-e4.
