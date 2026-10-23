# Brief: stop test traffic counting in the live sign-up counter

Lane: NORMAL (Website only, no DB change). Model: Sonnet. Branch: `claude/funnel-no-test-traffic` off origin/main.

## The failure (owner's words)
"find what is calling the sign-up counter 57 times (not real dancers) and stop test traffic counting"
Prod `auth_funnel_daily` for 2026-10-23 shows `onboarding_end ok = 83` and NO other steps. No real dancer did that.

## What the orchestrator already proved (prod edge logs, read-only, 22 Oct 23:00Z - 23 Oct 09:20Z)
Every call to `rest/v1/rpc/record_auth_funnel_step_v1` came from Microsoft (GitHub Actions) or Anthropic (cloud worker sandbox) IPs:
- UA `node`, no referer, status **204 (counted)**, ~70 calls. = Vitest unit tests in jsdom calling the REAL supabase client against the REAL prod URL. Cause: many dancer-app tests render via `renderInShell` and reach the end card (`stage === 'in' | 'nice'` in `src/modules/dancer-app/screens/onboarding/OnboardingScreen.tsx` ~line 78), which lazy-imports `@/lib/trackAuthStep` and fires `onboarding_end`. Only `tests/client/onboardingFunnel.test.tsx` mocks it.
- UA Chrome 153 with referer `http://127.0.0.1:4173/`, status 401 (not counted today, but must not call prod at all). = Playwright build specs (`tests/e2e-build/*`, vite preview on 4173).

## Fix the CLASS, not one test
1. **Unit tests can never reach live Supabase.** In the shared Vitest setup (find it via `vitest.config.*` `setupFiles`), make any real network request to a `*.supabase.co` host fail loudly (throw / reject with a clear message naming the URL), OR make `trackAuthStep` (and any other fire-and-forget prod writer you find in the same pattern: check `trackDancerEvent`, `trackAnalyticsEvent`, `emitProfileView`, `record_event_view_v1` callers) a no-op under `import.meta.env.MODE === 'test'`. Prefer the network block: it closes the whole class. Tests that mock fetch/the client must keep passing.
2. **Browser test runs do not count.** In `src/lib/trackAuthStep.ts`, skip the RPC when `navigator.webdriver === true` (Playwright, automation). Real phones never set it. Keep `tests/e2e-build/auth-consent.build.spec.ts` passing: if it asserts the RPC is called, have it assert via its existing mock/route that the call is skipped under webdriver, or set an explicit test-only override that is impossible in prod. Do not add a URL `?qa` flag that real users could hit.
3. **Guard (red first).** Add a unit test that proves a test-environment call to a supabase.co URL is refused (run it against the unfixed setup first and record that it fails). Add a unit test in `src/lib/__tests__/trackAuthStep.test.ts`: with `navigator.webdriver = true` no RPC call; with false, one call (existing behaviour).
4. Then grep the run output: `npm run test:unit` must print zero real requests to supabase.co. If any test now fails because it secretly relied on prod, mock it properly and list it in the PR body.

## Not in scope
No migration, no change to the admin repo or the RPC. Do not delete or edit prod rows (the 23 Oct numbers stay polluted; the orchestrator notes it). Stay out of `src/modules/organiser/**`.

## Done means
Every step of every CI job that applies (read `.github/workflows`, incl. unit, e2e-smoke, e2e-build, integrity, bundle budget) run in your sandbox, per-job table in the PR body, Verified / Not verified block. No visible change (Design Gate exempt).
Do NOT push again after your final commit + handover.
