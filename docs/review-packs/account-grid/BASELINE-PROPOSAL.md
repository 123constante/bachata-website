# Baseline proposal (slice 1b)

Rows the grid cannot cover today, to be recorded in `scripts/journey-grid-baseline.json` by the integration
step (`--write-baseline`). Computed with the JOURNEY-GRID rules: a `required` BUILT row needs one test and one
walk (J, R, E or OTP); an `optional` BUILT row needs one test; `NOT BUILT` and `PLANNED` rows are exempt.

## Exempt until their PR builds them (`built` is not `BUILT`)

| Rows | Covered by |
|---|---|
| `ac.delete.hide`, `ac.delete.restore-30`, `ac.delete.after-30`, `ac.delete.refused-sole-owner`, `ac.delete.admin-erase` (PLANNED, owner decision: hide + 30-day restore, never auto-erase; replace `ac.erase`, `ac.erase.sole-owner`, `ac.erase.admin`, `ac.erase.re-signup`) | PR-3 (settings behaviour) |
| `dl.new.real-otp` | PR-5 (real-OTP harness) |
| `di.new`, `di.dancer-part.signed-in`, `di.other-email`, `di.dead-token` | the dancer-invite PR (route not built) |
| `dp.erase-cancel-link` | PR-3 (route retired with the grace path) |

## BUILT but short of the rule (these belong in the baseline)

Walk missing (a unit test exists, no build walk): `dl.new.expired-link`, `dl.dancer.signed-in`,
`si.dancer.wrong-code`, `si.signup-refused`, `ti.member`, `ti.dead-token`, `cl.dancer.email-match`,
`cl.dancer.email-differs`, `cl.dancer-part`, `cl.org1`, `cl.managed`. Cover in PR-5 (OTP + walks) or the
PR that touches that screen.

Nothing at all (no test, no walk): `ol.admin-only.signed-in`, `dl.banner-href`, `si.unconfirmed-later`,
`si.code-step-reload`, `ti.new.other-device`, `ac.email-change` (PR-5b real-OTP spec), and the optional rows
`ol.org2.signed-in`, `si.org-only`, `xd.second-device`.

## Note for slice 1a

`si.signup-refused` cites `src/lib/__tests__/auth-signup-allowlist.test.ts`, whose tests are `it.each(...)`.
Rule 2 for `U` ("contains at least one `it(` or `test(`") must also accept `it.each(` / `test.each(`, or this
ref reads as dangling.
