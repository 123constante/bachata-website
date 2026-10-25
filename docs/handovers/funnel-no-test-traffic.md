# Handover: funnel no test traffic (dt_1a5a8f108d85)

Done
- `vitest.setup.ts`: fetch to any `*.supabase.co` host rejects with "Blocked live Supabase request ...". `*.contract.test.*` suites (deliberate read-only live contracts) are exempt, except `/rpc/record_*` which is always blocked.
- `src/lib/trackAuthStep.ts`: skips the RPC when `navigator.webdriver === true`.
- `tests/e2e-build/auth-consent.build.spec.ts`: the sign-up test overrides webdriver=false via `addInitScript` (test-only) so its mocked `code_ok` assertion still holds.
- Tests: `tests/client/noLiveSupabase.test.ts` (red on unfixed setup: 4/4 failed), webdriver true/false cases in `src/lib/__tests__/trackAuthStep.test.ts`.

Evidence: full `vitest run` prints 0 "Blocked live" lines, so no non-contract test reached supabase.co. No test needed re-mocking.
Remaining failures (15) are pre-existing/sandbox: 10 live contract tests (no network from sandbox) and 5 in integrityCouldNotRun.test.ts (environment).

Not verified: e2e-smoke, e2e-build (Playwright), integrity job, bundle budget, tsc is red on main for unrelated files (venue breadcrumbs etc.).
Next: open PR, let CI run the jobs above; 23 Oct prod rows stay polluted by design.
