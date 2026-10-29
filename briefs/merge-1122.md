# Brief: bring PR #1122 up to date with main (mechanical merge, no new code)

Branch claude/w3c-1-repeat (PR #1122). `main` moved (PR #1118 merged). Do exactly this:
1. git fetch origin main; git checkout claude/w3c-1-repeat; git merge origin/main.
2. The only conflict is package.json, the one-line `test:e2e` spec list. Resolve it as the UNION: take main's line and append ` tests/e2e/walk-w3c-1-repeat.spec.ts` right before ` --project=chromium`. Keep `tests/e2e/walk-p3-w4b-onboarding.spec.ts`. src/modules/organiser/p3/theme/p3.css auto-merges: confirm both sides' rules are present.
3. Run npm ci if needed, then `npx tsc --noEmit` (no new errors in touched files), `npm run test:unit` for the p3 repeat and p3 onboarding folders, and `npm run lint` if it is quick. Report anything red that is also red on main as pre-existing.
4. Push ONCE to claude/w3c-1-repeat; final commit subject ends [worker-done <ticket>]. No code changes beyond the merge resolution. Context under 35%.
