# e2e skipped-tests audit (2026-11-12)

Item 2 of 4 of the e2e audit. Report only: no test, config, workflow or secret
was changed, and no suite was run.

Measured on main `628700e` with:

```bash
grep -rnE "test\.skip|\.skip\(|test\.fixme|testInfo\.skip" tests/e2e | grep -v '^tests/e2e/live/'
```

That grep returns 56 lines. 4 are comments, not skips
(`walk-p3-promo-codes.spec.ts:10`, `walk-p3-wt-states.spec.ts:10`,
`walk-p3-series-pictures.spec.ts:8`, `event-ended-cls.spec.ts:78`). That
leaves **52 skip sites in 29 specs**. There are no `test.fixme` calls. There
is one `test.fail()` (`organiser-launch-walk.spec.ts:412`), which is covered
under "Not a skip, but related" below.

"Runs in" was read from `package.json` scripts, `.github/workflows/*.yml` and
the `MANUAL` list in `scripts/check-e2e-spec-coverage.mjs` (#1589). Only
`e2e-smoke.yml` runs specs under `tests/e2e/` outside `live/`, in two steps:

- **smoke**: `npm run test:e2e`. Sets `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, a
  placeholder anon key and no build.
- **p3**: `npm run test:e2e:p3`. Also sets `VITE_ENABLE_ORGANISER_P3`,
  `VITE_ENABLE_ORGANISER_TICKETING` and `P3_GEOMETRY_REQUIRED=1`.

## Summary

| Verdict | Sites | What it means |
|---|---|---|
| **fix** | 4 (in 3 specs) | They sit in a CI list, but the test never runs there. One never runs anywhere. |
| **delete** | 1 | An unconditional skip since 2026-04-25. The code it waits for no longer exists. |
| fine: flag-gated, in CI with the flag ON | 15 | The p3 step sets the flag, so the skip is never taken in CI. `check-p3-specs-not-skipped.mjs` guards this. |
| fine: flag-gated, manual walk | 8 | Walks in MANUAL. The flag is part of the documented run command, except for the 3 SW1 sites (fix-next 4). |
| fine: credential / real-backend gated, manual | 24 | 21 need E2E or real Supabase credentials; 3 cascade from data or an output dir. All in MANUAL, run by no workflow. |
| viewport-gated | 0 | None found. |
| flaky-quarantine | 0 | None found. |

4 + 1 + 15 + 8 + 24 = 52. Every site appears exactly once in the tables below.
The one unconditional (dead) skip is the **delete** row.

## Fix next (ranked)

1. **`event-hydration-421.spec.ts` and `event-ended-cls.spec.ts` are in the
   `test:e2e` gate but skip every time in CI.** Both start their own server only
   if `build/server` and `build/client` exist (`beforeAll`). `e2e-smoke.yml`
   never runs `npm run build`, so the fetch fails and every test skips with
   "production server not reachable". Even with a build, the placeholder key
   means the SSR loader has no real data, so the slugs would 404 and skip
   anyway. That is 2 + 4 = 6 test cases (2 events; 2 slugs x 2 viewports)
   showing green while asserting nothing. Fix: run them where they can work,
   for example in `live-qa.yml` against prod via `HYDRATION_BASE_URL` /
   `ENDED_CLS_BASE_URL`, both read-only page loads. Or move them to MANUAL and
   take them out of `test:e2e` so the gate stops claiming them.
2. **`dancer-app/home-nights.spec.ts:104` is dead everywhere.**
   `GOING_CHECKIN_ENABLED` is imported from `src/lib/goingCheckin.ts` into the
   Playwright Node process. There `import.meta.env` is absent, `readSwitch()`
   catches and returns `false`, and the "nudge -> Nights -> vote" test always
   skips, locally and in CI. The flag the spec reads is not the flag the dev
   server reads. Fix: gate on `process.env.VITE_ENABLE_GOING_PREVIEW` +
   `VITE_VERCEL_ENV` (what the server sees), or delete the test if the going
   switch stays preview-only.
3. **`vendor-city-normalization-smoke.spec.ts:307`: delete it.** This
   `test.skip('...', fn)` is unconditional and has been since 2026-04-25. Its
   comment waits on `optionCChecklist` / "City provided" in
   `CreateVendorProfile.tsx`, and neither exists in `src/` any more. The test
   can never come back as written. Delete it, or rewrite it against today's
   vendor flow.
4. **The SW1 gate-on walks have no documented run command.**
   `walk-sw1:117`, `walk-int4:119` and `walk-fix-sw1:97` skip unless
   `SW1_GATE=on`, "the build with the gate flipped". The MANUAL `run` commands
   for those three specs do not set it, so the documented command always skips
   the gate-on test. Fix (docs or MANUAL only): add the second command, or
   record that the gate-on screenshots are retired.
5. **The two `*.real-supabase.spec.ts` specs run nowhere on a schedule.**
   `organiser-edit-save-bar` and `organiser-public-claim` only read the public
   catalog (`from('organiser_profiles')` selects) and skip without a real anon
   key. Every CI run skips them, so they only ever run when someone remembers.
   They are a fair fit for the read-only `live-qa.yml` nightly. This is a
   decision for the owner, not a bug.

## Full tables (52 sites)

Key for "Runs in": **smoke** / **p3** are the two `e2e-smoke.yml` steps;
**MANUAL** means listed in `check-e2e-spec-coverage.mjs` with a run command
and run by no workflow. "Taken in CI?" asks whether the skip actually fires in
the CI job that runs the spec.

### Credential / real-backend gated (24 sites): fine, expected manual

| Site | Condition | Gate | Runs in | Taken in CI? | Verdict |
|---|---|---|---|---|---|
| organiser-real-rpc.spec.ts:154 | `refusal() !== null` | `ORGANISER_REAL_RPC_CONFIG=1`, `E2E_ORGANISER_OWNER_PASSWORD`, `E2E_ORGANISER_CONTRIBUTOR_PASSWORD`, `VITE_SUPABASE_URL`/`_PUBLISHABLE_KEY` (E2E project). A prod target throws instead of skipping. | MANUAL (`npm run test:e2e:organiser-real-rpc`) | n/a | fine |
| organiser-real-rpc.spec.ts:223 | `!seriesId` | cascade from step 2 (serial) | MANUAL | n/a | fine |
| organiser-real-rpc.spec.ts:231 | `!seriesId` | cascade from step 2 | MANUAL | n/a | fine |
| organiser-real-rpc.spec.ts:252 | `!seriesId` | cascade from step 2 | MANUAL | n/a | fine |
| organiser-real-rpc.spec.ts:267 | `!seriesId` | cascade from step 2 | MANUAL | n/a | fine |
| organiser-real-rpc.spec.ts:280 | `!seriesId` | cascade from step 2 | MANUAL | n/a | fine |
| organiser-real-rpc.spec.ts:344 | `!seriesId` | cascade from step 2 | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:132 | `refusal() !== null` | same env set as real-rpc | MANUAL (`npm run test:e2e:organiser-launch-walk`) | n/a | fine |
| organiser-launch-walk.spec.ts:262 | `!seriesId` | cascade from step 1 | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:276 | `!seriesId` | cascade from step 1 | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:332 | `!seriesId` | cascade from step 1 | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:333 | `!!NO_ADMIN` | `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:356 | `!approved` | cascade from step 5 | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:397 | `!approved \|\| !otherCityReady` | cascade from step 5 + other-city fixture | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:409 | `!approved` | cascade from step 5 (then `test.fail()`, see below) | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:427 | `!seriesId` | cascade from step 1 | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:464 | `!seriesId` | cascade from step 1 | MANUAL | n/a | fine |
| organiser-launch-walk.spec.ts:479 | `!seriesId` | cascade from step 1 | MANUAL | n/a | fine |
| organiser-edit-save-bar.real-supabase.spec.ts:92 | `!REAL_KEY` | real `VITE_SUPABASE_PUBLISHABLE_KEY` (not the placeholder) | MANUAL | n/a | fine (fix-next 5) |
| organiser-edit-save-bar.real-supabase.spec.ts:98 | `!SLUG` | data: a live organiser exists in the catalog | MANUAL | n/a | fine |
| organiser-public-claim.real-supabase.spec.ts:105 | `!REAL_KEY` | real anon key | MANUAL | n/a | fine (fix-next 5) |
| organiser-public-claim.real-supabase.spec.ts:111 | `!SLUG` | data: a live, unmanaged organiser | MANUAL | n/a | fine |
| vendor-city-real-supabase.spec.ts:44 | `missingVars.length > 0` | `.env.e2e` vars (`scripts/run-real-vendor-e2e.mjs`) | MANUAL (`npm run test:e2e:vendor:real`) | n/a | fine |
| dancer-app/review-pack.spec.ts:122 | `!DIR` | `REVIEW_PACK_DIR` (output dir, not a credential) | MANUAL | n/a | fine |


### Flag-gated, in the CI p3 step with the flag ON (15 sites): fine

The p3 step sets `VITE_ENABLE_ORGANISER_P3`, `_TICKETING` and `_SELF_SERVE`
to `'true'`, so none of these skips fire in CI.
`check-p3-specs-not-skipped.mjs` (architecture-guard) fails if a flag goes
missing or a skip is not flag-gated. A "probe" skip such as
`!mounted && P3 !== 'true'` therefore cannot hide a broken page in CI.

| Site | Condition | Gate | Runs in | Taken in CI? | Verdict |
|---|---|---|---|---|---|
| walk-p3-w4b-onboarding.spec.ts:42 | `!mounted && P3 !== 'true'` | `VITE_ENABLE_ORGANISER_P3` | p3 | no | fine |
| walk-p3-w4b2-person.spec.ts:42 | `!mounted && P3 !== 'true'` | P3 | p3 | no | fine |
| walk-p3-w4b2-page.spec.ts:54 | `!mounted && P3 !== 'true'` | P3 | p3 | no | fine |
| walk-p3-welcome-declined.spec.ts:52 | `!mounted && P3 !== 'true'` | P3 | p3 | no | fine |
| walk-p3-golive.spec.ts:47 | `!mounted && P3 !== 'true'` | P3 | p3 | no | fine |
| walk-p3-create-kinds.spec.ts:34 | `!mounted && P3 !== 'true'` | P3 | p3 | no | fine |
| walk-p3-create-kinds.spec.ts:42 | `P3 !== 'true'` (after `P3_GEOMETRY_REQUIRED` asserts P3 on) | P3 | p3 | no | fine |
| walk-p3-create-kinds.spec.ts:89 | `P3 !== 'true'` | P3 | p3 | no | fine |
| walk-w3c-1-repeat.spec.ts:158 | `!P3_ON` | P3 | p3 | no | fine |
| ticket-door-scanner.spec.ts:58 | `!MOUNTED` | P3 + TICKETING | p3 | no | fine |
| p3-landing-redirect.spec.ts:18 | `!P3_ON` | P3 and SELF_SERVE not `'false'` | p3 | no | fine |
| p3-gate-sheet.spec.ts:140 | `!P3_ON` | P3 | p3 | no | fine |
| p3-gate-overlays.spec.ts:97 | `!P3_ON` | P3 | p3 | no | fine |
| p3-gate-overlays.spec.ts:134 | `!TIX_ON` | TICKETING | p3 | no | fine |
| p3-add-profile.spec.ts:47 | `!P3_ON` | P3 | p3 | no | fine |


### Flag-gated, manual walks (8 sites): fine

| Site | Condition | Gate | Runs in | Taken in CI? | Verdict |
|---|---|---|---|---|---|
| walk-ticket-sales-report.spec.ts:16 | `!MOUNTED` | P3 + TICKETING | MANUAL (cmd sets both) | n/a | fine |
| walk-ticket-s1-pause-add.spec.ts:9 | `!MOUNTED` | P3 + TICKETING | MANUAL (cmd sets both) | n/a | fine |
| walk-getpaid-start.spec.ts:15 | `!MOUNTED` | P3 + TICKETING | MANUAL (cmd sets both) | n/a | fine |
| ticket-door-code.spec.ts:52 | `!MOUNTED` | P3 + TICKETING + `VITE_ENABLE_TICKET_DOOR_CODE` | MANUAL (cmd sets all three) | n/a | fine |
| walk-p3-batch-1-door.spec.ts:78 | P3 and TICKETING not both `'true'` | P3 + TICKETING | MANUAL (cmd sets both) | n/a | fine |
| walk-sw1.spec.ts:117 | `!GATE_ON` | `SW1_GATE=on` + a build with the gate flipped | MANUAL (cmd does NOT set it) | n/a | fine (fix-next 4) |
| walk-int4.spec.ts:119 | `!GATE_ON` | `SW1_GATE=on` | MANUAL (cmd does NOT set it) | n/a | fine (fix-next 4) |
| walk-fix-sw1.spec.ts:97 | `!GATE_ON` | `SW1_GATE=on` | MANUAL (cmd does NOT set it) | n/a | fine (fix-next 4) |


### In a CI list, but the skip hides a real gap (5 sites): fix / delete

| Site | Condition | Gate | Runs in | Taken in CI? | Verdict |
|---|---|---|---|---|---|
| event-hydration-421.spec.ts:67 | SSR 404 or no `routes/event` in body | a production `build/` + real data (`HYDRATION_BASE_URL` overrides) | smoke | **yes, always** (no build in the job; placeholder key) | **fix** (1) |
| event-hydration-421.spec.ts:69 | fetch throws | server reachable | smoke | **yes, always** (no server is started) | **fix** (1) |
| event-ended-cls.spec.ts:92 | `skipReason` set: 404, no bento grid, or unreachable | a production `build/` + real data (`ENDED_CLS_BASE_URL` overrides) | smoke | **yes, always** | **fix** (1) |
| dancer-app/home-nights.spec.ts:104 | `!GOING_CHECKIN_ENABLED` | `VITE_VERCEL_ENV=preview` + `VITE_ENABLE_GOING_PREVIEW=true`, but read from `import.meta.env`, which Node lacks | smoke | **yes, always, everywhere** | **fix** (2) |
| vendor-city-normalization-smoke.spec.ts:307 | none: `test.skip(title, fn)` | none | smoke | **yes, always** | **delete** (3) |

## Not a skip, but related

- `organiser-launch-walk.spec.ts:412`: `test.fail()` pins KNOWN DEFECT G3: a
  date with no session shows the series default time on the public site. It
  is green while the bug exists, by design, and goes red when the bug is
  fixed. Only the manual run sees it. Fine, but it is an open product defect
  that shows up as a pass.
- Guard gaps named by `check-p3-specs-not-skipped.mjs` itself: an early
  `return` on a probe, and a skip inside an imported helper, are not detected.
  A grep for `if (!mounted|P3_ON|MOUNTED|GATE_ON) return` under `tests/e2e`
  found no such early return today.

## Appendix: `tests/e2e/live/` (out of scope, listed for completeness)

7 sites in `live/shape-matrix.spec.ts` (lines 83, 88, 115, 131, 145, 178,
195). Line 83 skips with no shape survey (`SUPABASE_ACCESS_TOKEN` unset). The
other 6 skip when today's prod data has no row of a shape. `live-qa.yml`
(nightly 05:17 UTC) sets `SUPABASE_ACCESS_TOKEN` from secrets, so line 83
fires only if the secret is missing. The data skips are legitimate: they say
which shape was absent.

## Method / re-check

A reviewer re-runs the grep at the top. Every non-comment line must match one
row above, by `file:line`, and no row may be missing. The line numbers are for
`628700e`.
