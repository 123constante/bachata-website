# Handover: p3-wt-land (F-01..F-05)

PR #1249, branch `claude/p3-wt-land`. Ticket dt_6605b3ec9175. Brief: `brief/p3-wt-land:docs/briefs/p3-wt-land.md`.

## Done
- Most of F-01..F-05 had already shipped in #1237 (`lib/organiserAreaHome.ts`, the `ORGANISER_AREA_HOME_PATH` doors, the `/account/o/*` -> P3 redirect, and `?legacy=1` until `LEGACY_UNTIL`). This PR fixed what was still open:
  - **F-03 / A-gate-J3:** `/account/o/series/<id>` now keeps its event.
    - P3 live: it goes to `/account/p3/events/<id>` (`r1ToP3Path`).
    - Old area kept: R1's new `series/:seriesId` route goes to `/account/o/events/<id>` (`r1LegacyPath`).
  - **F-05 / A-team-29:** `acceptedInviteLanding` now goes to P3 Home `?o=<id>`. The label is "Open your organiser home" for both flags, and `buttonP3` is removed.
    - The Done link passes Home's `confirmation` state (review r1 F1). This stops a stale cache with no pages from sending a new member to Start.
  - **F-04:** `EmailCodeProof` is unchanged, because Door.test pins it byte for byte. Its default `/account/o` reaches P3 Home through the redirect, and a table row proves it.
  - **Review r1 F2:** `seg()` no longer throws on a malformed escape.
- Tests:
  - New `src/lib/__tests__/p3WtLand.table.test.ts` (one `land()` follower over the shared mapping). It went red first: 12 failures on main.
  - Mount rows added in `p3Redirect.mount.test.tsx`, and a state test in `loginDeadEnds.table.test.tsx`.
- Shape survey (prod, counts only): 44 accounts.
  - 15 have a page (14 with one page, 1 with two or more).
  - 29 have no page (3 are dancer-only, 26 have nothing).
  - 4 are admins (2 with a page).
- Bundle: `check:bundle-budget` output is identical to main, so 0 bytes are added to the dancer-app first load.
- Review: one independent review, one fix round (F1 and F2 fixed). The stopping rule is met.

## Not verified
- `test:e2e` and `test:e2e:p3` were not run locally; CI runs them.
- `check:doc-weight` needs a preview URL, so it was not run.
- No 390x844 browser walk was done, and nothing was checked on a phone.
- 15 unit tests fail here. They are live-DB contract tests and `integrityCouldNotRun`, and they fail on main in this container too.

## Next steps (orchestrator)
1. Check the PR's CI per job, especially `e2e-smoke` (test:e2e and test:e2e:p3).
2. Walk at 390x844 on the preview:
   - accept an invite as someone with no page, tap Done, and confirm the confirmation line shows and then P3 Home (not Start);
   - open `/account/o/series/<real id>` and confirm it shows P3's event page;
   - add `?legacy=1` and confirm it shows R1's event page.
3. Open question, not a defect: P3 Home ignores `?o=`, so the invite's `?o=<id>` does not pick a page on Home (A-team-2 territory).
