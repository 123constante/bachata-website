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
