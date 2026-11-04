# BRIEF: auto-walk-pictures-1 (Website; careful lane; Opus; workflows are applied by the lead)

Brief-version: 2

Goal (owner 2026-11-04, "automated and quick"): every UI PR gets 390x844 pictures of the screens it changed, taken by CI with no human and no sign-in, so the review pack can show them. Today the `phone-qa` job (tests/e2e-phone, fake Supabase) checks contrast and taps but saves no pictures, and the orchestrator walk on a preview is blocked by sign-in.

## What main lacks
- extends: a helper that screenshots the page at 390x844 into `test-results/auto-walk/<name>.png` and returns the path (one call per state) -- tests/e2e-phone/helpers.ts
- extends: a script that maps a PR's changed UI files (the same UI_PATH_RE the Phone QA checker uses; read it from scripts/check-pr-phone-qa.mjs, do not retype) to a list of existing phone specs / routes to shoot, and writes `auto-walk-manifest.json` (file, state, picture, sizes) -- scripts/auto-walk-manifest.mjs
- extends: tests: manifest mapping table (UI file -> specs), fail-closed when a UI file has no mapped state (manifest says "NOT covered: <file>", never silently empty) -- tests/autoWalkManifest.test.ts

## Files
- tests/e2e-phone/helpers.ts
- scripts/auto-walk-manifest.mjs
- tests/autoWalkManifest.test.ts
- docs/handover/auto-walk-pictures-1.md

## What to build
1. Read the existing phone specs and fakeSupabase to see which screens already have a driven state. Start with the organiser P3 screens (dates, door, checklist, onboarding).
2. Build the helper, the manifest script (with `--self-test`), and the table test. Red first.
3. Do NOT edit `.github/workflows/**` (worker rule). In the handover, give the exact workflow diff for the `phone-qa` job: run the specs, run the manifest script, upload `test-results/auto-walk` as an artifact named `auto-walk`, and print the manifest into the job summary. The lead applies it.
4. List in the handover which changed-file classes are NOT covered yet, so the pack can say so.
5. Run: `npm run lint`, vitest on the new test, `npm run check:integrity`, `npm run check:mojibake`, `npx playwright test` for the specs you touched if the sandbox has a browser, else say not run.
6. PR body: real-data lines and a bare `## Phone QA` heading. Push once; last commit subject ends `[worker-done <ticket>]`.
