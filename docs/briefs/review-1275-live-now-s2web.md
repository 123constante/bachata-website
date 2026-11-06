# Brief: independent review of Website PR #1275 (live-now slice 2: snapshot version + contract check), READ-ONLY review
Brief-version: 2

Branch: `claude/review-1275-live-now-s2web` (new, one review report file only; never push to claude/live-now-s2web). Lane: careful. Model: opus.

## What main lacks
- an independent review of a new CI contract check and workflow step -- grep: review-1275-live-now-s2web

## Scope
Review PR #1275 (branch claude/live-now-s2web, head e7f4fb92; `git fetch origin claude/live-now-s2web`, diff against origin/main). Files: .github/workflows/db-contract-check.yml (one new step), scripts/check-event-snapshot-version.mjs (new), scripts/prove-entry-point-dispatch.mjs, src/modules/event-page/types.ts, src/modules/event-page/useEventPageQuery.ts, two event-page tests, tests/eventSnapshotVersion.test.ts, docs/handovers/live-now-s2web.md. Prod is read-only (Supabase SELECT). Context: admin PR #1280 added a top-level `version` number to the snapshot_compat branch of event_view_p5 on prod (applied 2026-11-06T19:33Z); this PR makes the Website read it and adds a contract check that pins it.

Questions, each answered with file:line evidence:
1. Workflow safety: does the new step in db-contract-check.yml follow the repo's script conventions (docs/ci-guard-notes.md: the six rules check-script-conventions.mjs enforces), use only existing secrets, add no write path to prod, and run read-only? Any change to triggers, permissions or runs-on?
2. The check: does it fail when `version` is missing, null, a string or the wrong type on the compat shape, and pass when it is a number? Is it fail-closed when the RPC errors, returns null, or returns a non-object? Does it need data that may not exist (a live series id)? Name 3 mutants (drop the type check, accept null, skip the compat shape) and say whether tests catch each; run them.
3. Parser: `useEventPageQuery.ts` / `types.ts`: can a missing or malformed `version` crash the event page or change what a visitor sees? The version must be additive and optional on the page.
4. `prove-entry-point-dispatch.mjs`: why it changed, and does the change weaken that guard?
5. Anything that makes the live /event page slower or adds a request.

## Files
- docs/review/review-1275-live-now-s2web.md (new)

## Do
Write docs/review/review-1275-live-now-s2web.md: verdict (SAFE TO MERGE / SAFE AFTER FIXES / NOT SAFE), findings ranked with evidence, PROVEN vs SUSPECTED, exact minimum fixes. Push once; commit subject ends `[worker-done <ticket>]`. Change no code. Do not add labels.

## Done
Report: verdict line, finding count by severity.
