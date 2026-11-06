# BRIEF: automerge-test-imports-scripts (Website; careful lane; Opus; hard-tier file)

Brief-version: 2

Source: arc file docs/arcs/automation.md, "Slices not yet briefed" row "Follow-ups from the auto-merge review" (queue note: "Website class C: refuse test files that import scripts/ like admin testSourceRefusal; test copied-file refusal").

Admin's classifier refuses a class-C test file that imports `scripts/` (a gate's own test is owner-merged, because weakening it weakens the evidence behind later PRs). The Website classifier has no such rule.

## What main lacks
- extends: `classify()` refuses a class-C test file whose ADDED patch lines import from a `scripts/` path (`from '../scripts/...'`, `import("../scripts/...")`, `require`), with a named reason `<path> imports scripts/ (a gate's own test is owner-merged)`; a missing or truncated patch for a class-C file is also a NO -- scripts/automerge-classify.mjs (admin reference: `git grep -n testSourceRefusal origin/main` in 123constante/bachata-admin, read-only; port the idea, not a copy-paste of its Supabase/node:test lines)
- tests: table of class-C files (clean test; imports ../scripts/x.mjs; dynamic import; import only in a removed line; patch missing; docs file mentioning "scripts/" in prose) x qualifies, red first on main -- tests/automergeClassify.test.ts
- tests: the existing refusal for copied/renamed tests (`renames or copies a test`) has a direct table cell for status copied and for previous_filename -- grep: renames or copies a test (no test hit on main)

## Files
- scripts/automerge-classify.mjs
- tests/automergeClassify.test.ts
- docs/handover/automerge-test-imports-scripts.md

## What to build
1. Red first: add the cells, run on main, keep the red output in the handover.
2. Scan only ADDED lines of class-C files; docs (class A/B) are never scanned by this rule. Fail closed. Keep `selfTest()` green and add one canary case.
3. Do not edit scripts/lib/autopilot-merge.mjs (another brief owns it) or any workflow.
4. Run: `npm run lint`, `vitest run tests/automergeClassify.test.ts tests/autopilotMerge.test.ts`, the file's `selfTest` canary from its header, `npm run check:mojibake`, `npm run check:integrity`.
5. PR body: real-data lines (shapes = the table) and a bare `## Phone QA` heading "no UI path changed". Hard-tier: the owner Approves at head.
6. Push once; last commit subject ends `[worker-done <ticket>]`.
