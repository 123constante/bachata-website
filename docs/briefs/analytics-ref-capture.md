# Organiser analytics W1: capture ?ref= and send p_ref_code (NORMAL lane, no database change)

Brief-version: 2
Branch: claude/analytics-ref-capture (from main). One push. Normal lane, context cap 50%. No `supabase/**`.

## Decisions
Admin PR #1252 is merged and applied on prod (checked 2026-11-06: `organiser_analytics_v2` exists, `event_views.ref_code` exists). The two writers now accept a trailing `p_ref_code text DEFAULT NULL`; old callers still work. Contract (docs/organiser-analytics.md in the admin repo): the code is stored only if it matches `^[a-z0-9]{6,12}$` exactly; anything else is stored untagged by the database, so the client sends it lower-cased and shape-checked, and sends nothing when absent or malformed. The code travels as `p_ref_code`, never inside `source`. This slice is dark until the share-link card ships, so it must be harmless with no `?ref=`.

## What main lacks
- A reader that captures `?ref=<code>` from the landing URL, validates its shape and keeps it for the session -- grep: captureRefCode
- `useRecordEventView` sends `p_ref_code` when a valid code is held -- grep: p_ref_code
- `recordEventLinkClick` sends `p_ref_code` when a valid code is held -- grep: refCodeForTracking
- extends: the tracking contract check must know the new optional parameter -- scripts/check-tracking-rpc-contract.mjs

## Files
- src/lib/refCode.ts (new)
- src/lib/__tests__/refCode.test.ts (new)
- src/modules/event-page/useRecordEventView.ts
- src/lib/eventLinkClicks.ts
- scripts/check-tracking-rpc-contract.mjs
- src/main.tsx

## What to build
1. `src/lib/refCode.ts`: `captureRefCode(search: string)` reads `ref`, lower-cases, keeps only `^[a-z0-9]{6,12}$`, stores it in `sessionStorage` (try/catch; private mode must not throw) and returns it; `refCodeForTracking()` returns the held code or null. Call `captureRefCode(window.location.search)` once at app start. A later landing with a new valid `?ref=` replaces the held one; an invalid one leaves it unchanged.
2. `useRecordEventView`: add `p_ref_code` to the RPC args only when `refCodeForTracking()` is non-null. Existing args, the 3 s delay and the tracking flag are untouched.
3. `recordEventLinkClick` and its `RpcParams`: add optional `p_ref_code` the same way (omit the key when null).
4. Update `scripts/check-tracking-rpc-contract.mjs` so the writer signatures it expects include the optional trailing `p_ref_code`; the check must still go red if a required parameter is dropped.

## Tests
Table-driven, red first (run against unfixed code to show red). `?ref=` shapes x outcome: valid 10-char, uppercase (lower-cased and accepted), 5 chars, 13 chars, `abc-def123`, empty, repeated `ref=a&ref=b` (first wins), absent -> held code or null. Hook and click tests: with a code the RPC args include `p_ref_code`; without one the key is absent (exact arg object asserted, so an untagged call is identical to today). `sessionStorage` throwing -> no crash. Nothing sends `ref` inside `source`.

## Done when
Unit tests, lint chain and tsc green; every CI job step that applies run, with a per-job table in the PR body; one push. PR body has a Verified / Not verified block. Verified: the shape table and the arg-object equality. Not verified: a real tagged view on prod (no share-link card exists yet, so no organiser can hand out a code).
