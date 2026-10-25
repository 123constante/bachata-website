# Handover: dancer page F13 (dt_1ec9e5f0e920)

Done: model + PublicDancerPageV2 rebuilt to F13 teal; tests (`__tests__/f13.test.tsx`, page.test updated); docs/handover/dancer-page-f13-design.md.
Local checks: vitest src/modules/dancer-app + tests/client + tests/regression 1918 pass; typecheck 97 errors (baseline 106); npm run build exit 0; check:images 0 missing; eslint clean on the module.
Not verified: 390x844 browser walk with real data, shape survey (Supabase), full CI job list, code-review round, Going next (built OFF, no data source).
Next: browser walk, owner decision on Going next opt-in, /code-review before merge.

## Isolation fix (dt_98c5199e7e7e)

- Moved `docs/dancer-page-f13.md` to `docs/handover/dancer-page-f13-design.md` (allowed docs dir). References fixed in `PublicDancerPageV2.tsx` and this file. Check script and allow-list untouched.
- `npm run check:dancer-area-isolation` vs origin/main (c36fbaf): BEFORE "1 violation(s) ... docs/dancer-page-f13.md"; AFTER "dancer-area isolation: OK" (exit 0). `--self-test`: 48 cases, all behave (exit 0).
- `bin/check-integrity.sh`: ok, 0 issues (exit 0).
- `check:doc-weight`: NOT run to a verdict; needs a deploy preview probe (`GITHUB_REPOSITORY` unset), errors identically on clean origin/main. bom-check: no such script in package.json, not run.
- Organiser `ProfilePage.test.tsx` sign-out failure (not in this PR, not touched): 5/5 runs here passed (10/10 tests) and 1/1 on clean origin/main passed. Not reproduced; looks flaky (CI-timing dependent), no evidence main has it deterministically.
- Not verified: full unit suite, CI on GitHub (billing may refuse).
