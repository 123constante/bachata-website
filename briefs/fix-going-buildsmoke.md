# Brief: fix-going-buildsmoke (Website, one fix worker, ONE push, no new PR)

Branch `claude/going-hidden` (PR #836, head 3f23a75e; do NOT open another PR). Plain git only, never `gh api`. No variables/loops/`$(...)` in shell.
Never merge/approve, never `--no-verify`, Supabase read-only. Push ONCE. Stop after the push. Another worker (dt_16cc3eec408a) is idle on this branch: you are the only one that may push now.

## Failure the orchestrator saw (red on #836, twice in a row, so not random)
GitHub check `build-smoke` (workflow Phone QA, step "Run the production-build smoke") fails:
`tests/e2e-build/auth-consent.build.spec.ts:63 "sign-up code box: consent line, recorded once on success"` at line 75:
`expect(received).toBe(expected)  Expected: 1  Received: 2` = the sign-up consent (`accept_terms_v1`) is recorded TWICE.
The same job PASSED on the previous merged PR (#821 head 583c3664, main 0a9d2d4e). So this PR (Going hidden behind `GOING_CHECKIN_ENABLED`, no auth code touched) introduced it, probably through a build/chunking side effect.
This matters: consent being recorded twice is a real defect if it is real. Do not just re-run or loosen the test.

## Task
1. Read `.github/workflows/phone-qa.yml` for the exact build-smoke commands; reproduce in your sandbox: production build (`npm run build`) then that spec only. Red on this branch head? Green on `origin/main`? Report both.
2. Bisect the six commits of this branch (`git log origin/main..HEAD`) to the first one that turns it red. Prime suspect: `4b47ae8d` "pin goingCheckin into lib-event-rules" (vite.chunks.ts / chunkClassifier), which can duplicate a module into two chunks and so run a module-level subscription twice. Confirm or refute with evidence (chunk contents, or the spec's own request log).
3. Fix the ROOT CAUSE with the smallest change, red-first (the spec itself is the red test; do not change it unless it is provably wrong). If the cause is the chunk pin, find another way to keep `goingCheckin` out of a new first-load chunk (the bundle-budget check must stay green) OR drop the pin and prove bundle-budget still passes; show both numbers. Do not edit the check scripts' limits.
4. Re-run in the sandbox: that spec, the full `tests/e2e-build` suite, `check:bundle-budget` (or whatever the workflow calls it), `check:dancer-area-isolation`, and the unit tests that mention goingCheckin/chunks. List per-job results with exit codes.
5. Append a short "build-smoke fix" section to `docs/handover/going-hidden.md` (cause, evidence, fix, results, Not verified). One commit, subject ending `[worker-done <your ticket>]`, ONE push.
