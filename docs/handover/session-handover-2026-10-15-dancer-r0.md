# Session handover 2026-10-15: dancer rebuild R0

Branch `arc/dancer-app-r0`, no PR. Full detail: `docs/handover/dancer-rebuild-r0.md`.

Done: regression suite `tests/regression/today/**` (368 tests, green x4), `scripts/check-dancer-area-isolation.mjs` + self-test (green),
job `dancer-area-isolation` added to `.github/workflows/unit-tests.yml`, one `package.json` script line.
Open: the 3 red-first mutants; typecheck, lint chain, build, full unit run, other workflow jobs.
Next: continue from the "What is left" list in the main handover; then orchestrator merges into `claude/dancer-app-r1a`.

New-session prompt: "Zero-context worker on 123constante/bachata-website, branch arc/dancer-app-r0 (exists; do not recreate). Read
docs/handover/dancer-rebuild-r0.md and finish its 'What is left' list: run the three red-first mutants (apply, run
npx vitest run tests/regression, quote failing test names into the handover, revert with git checkout), then npm run test:unit, lint,
typecheck, build. Never gh api, never open a PR, never edit src outside the mutants. Commit, push the branch once, final commit subject
ends with [worker-done dt_751eb18dd9e8]."
