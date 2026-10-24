# Session handover 2026-10-23 -- people arc S2 (dancer world)

- Branch: `claude/people-dancer-world`. PR: #986. Content commit `908654d`, handover commit `dd75189`.
- Full handover: [`docs/people-arc/s2/HANDOVER.md`](people-arc/s2/HANDOVER.md). Design record:
  [`docs/design/people-s2-dancer-world.md`](design/people-s2-dancer-world.md).

## Done
- `/dancers/:id` dancer world behind `flags.personWorlds` (frame, teal card, D6 lower half, D8 invite).
- 77-case matrix; local CI steps; browser walk on prod data (11 shapes x 390/360), Design Gate 4 checks.
- PR #986 CI on `dd75189`: every check that ran is green (unit x3 timezones, e2e-smoke, phone-qa, build-smoke,
  integrity, bundle-budget, contract-check, dancer-area-isolation, real-data-verified, phone-qa-section);
  preview-only checks (lighthouse, seo, og, synthetic) skipped.

## Open
- Owner: set Preview env var `VITE_ENABLE_PERSON_WORLDS=true` for branch `claude/people-dancer-world` and
  redeploy (the Vercel API is blocked from the worker sandbox).
- Owner calls: bio, and the v2 sections the reference drops (gallery, practice stamp, achievements, songs/styles).
- Brief step 3 (dancer-app language/city copies) blocked by the isolation guard rule a: a one-file follow-up PR
  (only `src/modules/dancer-app/public-page/model.ts` + tests), steps in the S2 handover.
- Needs S3/frame: history Back, DJ font on this page, a time label in `facts/`, footer gap on short pages.

## Next
- After the owner's preview check: merge decision on #986 (workers never merge).
- Then the step-3 follow-up PR.
