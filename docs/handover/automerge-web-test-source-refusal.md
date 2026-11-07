# Handover: automerge-web-test-source-refusal (dt_86f06b978217)

Brief: `brief/automerge-web-test-source-refusal` (blob d73bb2ad). PR: W#1468 (hard tier: owner Approve at final head).

## Done
- `scripts/automerge-classify.mjs`: `testSourceRefusal(path, text)` refuses node:test, quoted paths through scripts/, Supabase references, and unreadable/empty/binary content. `readTestSources()` reads class-C head content through the contents API. `classify({ testSources })` fails closed when the sources were not read. Wired into `main()`. Two selfTest cases added.
- `tests/automergeClassify.test.ts`: table rows for each refusal and for classify, a copied test refused as class C, readReviewRecord query params, readTestSources failure modes. Red first: 28 failures on unfixed code. The copied-test and query-param tests passed on unfixed code (they pin existing behaviour).
- `docs/automerge.md`: a "Class C content" section and a qualifies-table row. `docs/arcs/automation.md`: follow-ups row updated.

## Left / next steps
- The port follows the brief's spec. The admin source was NOT compared (this session cannot reach the admin repo), so a reviewer with admin access should diff the refusal rules.
- The other follow-ups in the arc row (label rule = last bot add, review comment before label) are still open.
- Owner: Approve at the final head. CI results on W#1468 are the record for e2e, phone-qa, perf and db-contract (not run locally).

## Verified / Not verified
- tsc run on 294b538: 0 errors in branch files. The repo tsconfigs exclude tests/ and scripts/, so the touched test was also checked with an ad-hoc config extending tsconfig.app.json; the only output was the 4 pre-existing `@ts-expect-error` lines.
- Verified: automergeClassify 207/207; lint 34/34; check:mojibake clean; selfTest ok; unit suite fails 15 tests in 4 unrelated files, the same on unfixed main (env: Supabase key).
- Not verified: a live bot-automerge run; the admin source parity; the Vercel preview (needs owner: Vercel token).

## Fix round 1 (dt_0afa6f1bf6dc, brief automerge-web-test-source-refusal-fix1)

Findings from the independent review of W#1468 at abc44a3:

1. MUST-FIX, scripts rule misses `execSync('node scripts/x.mjs')` and `.github/` paths: FIXED. New exported `REFUSED_TREES` in `scripts/automerge-classify.mjs`: a quoted `node scripts/` (or `node ./scripts/`) command; `.github` as any quoted path segment (bare `'.github'` too); `bin/`, `api/`, `server/`, `supabase/` as a ROOT-level directory segment (at the quote, after `./`/`../` runs, or after `${...}/`). Deviation from the brief's letter: a segment ANYWHERE would have refused `vi.mock('@/integrations/supabase/client')` (finding 3 says that must pass) and `../src/lib/api/...`, so these four trees are anchored to the repo root. The existing scripts rule is kept. `tests/autopilotWorkflow.test.ts` on main is now refused. Rows: 9 refused shapes, 6 allowed (`binary`, `public/api-notes.md`, `abin/`, `my-server/`, nested `src/lib/api/`, `raw.githubusercontent.com`), plus a classify row.
2. MUST-FIX, 6-cell arc row in a 4-column table: FIXED, now Item / Repo / Blocked by (status moved in) / Source.
3. Nit, bare `/supabase/i`: FIXED. Exported `SUPABASE_LIVE`: `SUPABASE` (upper case), `SERVICE_ROLE` (any case), `@supabase/supabase-js`, `createClient(`, `supabase.co`; plus `.from(`/`.rpc(` on a variable the test assigns from a `...client...(` call. vi.mock / type import of `@/integrations/supabase/...` passes; `vi.mocked(supabase.from)` passes. Rows: SERVICE_ROLE, createClient(, supabase.co, .from(, .rpc( refused; vi.mock, type import, mocked supabase.from allowed; classify rows for service role (NO) and vi.mock only (YES).
4. Nit, wording: FIXED in `docs/automerge.md`, the code comment and the test comment ("Adapted from the admin classifier: stricter on node:test and scripts/, different on Supabase"); the doc says a literal U+FFFD is refused.
5. Nit, counts on main (276 class-C test files at origin/main 5f198e3, node one-liner, no repo edit): **47 imports scripts/, 32 CI / tooling tree, 20 Supabase** = 99 refused, 177 pass. For comparison the abc44a3 rules refused 153 (73 scripts/, 80 Supabase): the Supabase relaxation lets about 54 mock-only suites through, the new trees rule catches suites that read workflows or shell out.

Tests: red first, 19 failures on abc44a3 code (18 new rows + the distinct-reasons test). Mutations: `REFUSED_TREES = []` -> 11 fail; dropping `SERVICE_ROLE` -> 2 fail. Green after: automergeClassify 232/232, selfTest ok.

Verified (fix round 1): automergeClassify + realDataVerified + automationMoney + automationGuardPaths 497/497; `npm run lint` 34/34 links green (eslint informational); check:mojibake clean; selfTest ok. tsc: the repo tsconfig has `files: []`, so the touched test was checked with an ad-hoc config extending tsconfig.app.json: 0 errors in branch files beyond the 4 pre-existing `@ts-expect-error` (TS2578) lines on the .mjs imports, same as round 1.
Not verified: a live bot-automerge run on a real class-C PR; admin source parity; PR 1468 CI at the new head (the lead updates the body); the Vercel preview (needs owner: Vercel token).
