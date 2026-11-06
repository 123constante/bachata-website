# Brief: static iOS-class scanner for the walk gate (Part C, contract 11 item 5b)
Brief-version: 2
Branch: claude/walk-ios-static-scan
Lane: careful, Opus. 123constante/bachata-website, scripts/lib and its test only; no workflow, no package.json, no src/**, nothing is wired into CI or the judge.
Serves: the owner and lead (iOS Safari bugs the Chromium walk cannot see are caught by a measured number instead of a phone check).

## What main lacks
- The judge rubric asks for three iOS numbers (iosInputFontSize >= 16, iosNoRawVh <= 0, iosFixedBarsSafeArea <= 0) but nothing produces them -- grep: scanIosClasses
- extends: rubric ids and thresholds live in scripts/lib/walk-judge.mjs (RUBRIC, lines 66-75); the scanner must emit exactly those report keys
- Real code has both good and bad shapes the scanner must tell apart (100vh at src/index.css; fixed bars with env(safe-area-inset-*) at src/components/organiser/GetListedHoloCta.css:6-7 and src/components/AppChrome.tsx:118)

## Files
scripts/lib/walk-ios-static.mjs (new)
tests/walkIosStatic.test.ts (new)
docs/automation/judge-worker.md (one line: Part C static scan exists, not wired)

## What to build
1. Pure `scanIosClasses(files)` where files = [{ path, text }] (CSS and TSX/HTML text). Returns { iosInputFontSize, iosNoRawVh, iosFixedBarsSafeArea, findings[] } with the three numbers named exactly as the rubric ids: minimum input font px found (Infinity-safe: no inputs found = 16 and a finding saying so, never a silent pass of a bad value), count of `100vh` declarations with no `dvh`/`svh` fallback in the same rule, count of `position: fixed` rules/classes with no `env(safe-area-inset-` in the same rule. Never throws; malformed input returns a red-shaped result (all counts 1, one finding).
2. A tiny rule splitter (no new dependency) good enough for plain CSS blocks and Tailwind arbitrary classes such as `h-[100vh]`, `text-[14px]` on input/textarea/select, `fixed bottom-0`; document what it does NOT parse in a comment (minified CSS, CSS-in-JS) and return a finding when it meets such text.
3. `main(argv)` CLI: `--dir <built or src dir>` reads .css/.html/.tsx, prints the JSON, exit 0 when all three numbers meet the rubric, 1 otherwise, 2 usage.
4. Add the file to the entry-point TARGETS list in scripts/prove-entry-point-dispatch.mjs the same way the other walk modules are.

## Tests
Table-driven, red first (the test file fails to load the module before step 1): good and bad row for each of the three classes, raw 100vh with and without dvh, fixed bar with and without safe-area, input 14px vs 16px, Tailwind arbitrary values, no inputs at all, empty file list, malformed argument, minified CSS finding. Three mutants (ignore dvh fallback, ignore safe-area, off-by-one on 16) each turn a test red. One test feeds the output through `judgeVerdict` keys: the three property names equal the RUBRIC ids. Run `npx vitest run tests/walkIosStatic.test.ts tests/walkJudge.test.ts`, `node scripts/check-script-conventions.mjs`, `node scripts/prove-entry-point-dispatch.mjs`, `npx tsc --noEmit -p .` filtered to changed files.

## Done when
- New tests green, mutants killed, existing walk tests untouched.
- PR body: Verified / Not verified (Not verified: not run against the real built site yet; hard-tier path, owner Approve at head).
