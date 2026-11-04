# Handover: auto-walk-pictures-1

Branch `claude/auto-walk-pictures-1`. Brief: `brief/auto-walk-pictures-1:docs/briefs/auto-walk-pictures-1.md` (v2).

## Done

- `tests/e2e-phone/helpers.ts`: `autoWalkShot(page, name)` saves `<AUTO_WALK_DIR or test-results/auto-walk>/<name>.png` and returns the path. It only shoots at 390x844 and returns `null` at any other size. No spec calls it yet; it is there for new specs.
- `scripts/auto-walk-manifest.mjs`:
  - imports `UI_PATH_RE` from `scripts/check-pr-phone-qa.mjs`.
  - `MAP` sends each UI file to the existing walks (`WALKS`) that drive its screen and already save screenshots. No spec was edited: `--run` points each walk's own picture env var (`SHOTS` / `P3_WALK_DIR` / `DOOR_SHOTS`) at `test-results/auto-walk/<walk>/`. Pictures a walk writes to a fixed path are copied in, but only the ones written during this run, so committed pngs never count.
  - Writes `test-results/auto-walk/auto-walk-manifest.json` with `covered[] = {file, state, picture, sizes}` and `notCovered[] = "NOT covered: <file>[ (reason)]"`.
  - Fails closed: an unmapped UI file, a walk that left no picture and a walk that failed (`exit N`) each produce a NOT covered line. A PR with no UI change gets a `reason` saying so.
  - Pictures at other sizes (`412x915`, `360x640`, `-360-`) are dropped, so every picture is 390x844.
  - Modes: `--run`, no-run collect, `--summary` (markdown), `--self-test` (10 cases, which also drive `main()`'s 0/2 exit codes).
  - Exit codes: 0 when the manifest is written. NOT covered lines are reported, not gated. 2 when `PR_FILES` is missing or empty, or `--summary` cannot read the manifest. 1 when the self-test fails.
- `tests/autoWalkManifest.test.ts`: 40 cases covering the mapping table, NOT-covered fail-closed, the size filter, every walk's spec/config existing, and the `main` exit codes. It was red first (module missing), now green.

## Real run (sandbox, 2026-11-04)

`PR_FILES=<door, ContactSheet, Parties> node scripts/auto-walk-manifest.mjs --run`:
- p3-door: 9 passed, 10 pictures.
- organiser-contact-sheet: 12 passed, 2 pictures at 390x844 (the 360/412 ones were dropped).
- `NOT covered: src/pages/Parties.tsx`.

I opened `p3-door/1-ready.png` and it shows the real Door screen at 390x844.

## Workflow diff for the lead (`.github/workflows/phone-qa.yml`, job `phone-qa`)

I did NOT apply this (worker rule). Two changes are needed:
- `fetch-depth: 0` on checkout, so the diff against main works.
- The artifact upload is a guard-maintenance change. `check-workflow-artifact-policy.mjs` records the repo's upload-step count (see the comment in the job), so bump that recorded count in the same commit.

```diff
       - name: Checkout
         uses: actions/checkout@v7
+        with:
+          fetch-depth: 0
@@
       - name: Run the phone suite (390x844 and 360x640)
         run: npx playwright test --config playwright.phone.config.ts
+
+      # Auto-walk pictures for the review pack (scripts/auto-walk-manifest.mjs).
+      # Runs even when the suite is red, so a failing PR still gets its pictures.
+      # Reports only: NOT covered lines never fail the job.
+      - name: Auto-walk pictures (390x844)
+        if: ${{ !cancelled() && github.event_name == 'pull_request' }}
+        env:
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
+        run: |
+          PR_FILES="$(git diff --name-only "$BASE_SHA"...HEAD)" node scripts/auto-walk-manifest.mjs --run
+          node scripts/auto-walk-manifest.mjs --summary >> "$GITHUB_STEP_SUMMARY"
+
+      - name: Upload auto-walk pictures
+        if: ${{ !cancelled() && github.event_name == 'pull_request' }}
+        uses: actions/upload-artifact@v4
+        with:
+          name: auto-walk
+          path: test-results/auto-walk
+          if-no-files-found: error
+          retention-days: 14
```

`if-no-files-found: error` is safe because the manifest file is always written.

Time cost: each mapped walk is one extra Playwright run. The phone walks start their own dev server, and so does the smoke config. Measured here: about 1.2 min for door and 3.4 min for contact-sheet. The job's `timeout-minutes: 25` may need raising for PRs that touch many walk classes.

## NOT covered yet (the pack must say so)

| Changed-file class | Why |
| --- | --- |
| P3 All dates / date sheets (`p3/screens/AllDatesScreen.tsx`, `DateSheet.tsx`, `DateFieldSheets.tsx`, `CancelEventSheet.tsx`) | No walk drives them and takes a picture. `p3-w3b2-geometry.spec.ts` is static markup with no screenshot. |
| Other P3 screens (`DetailsScreen`, `PricesScreen`, `StatsScreen`, `LineupSheet`, `SessionSheet`, `StatusSheet`, `EventPage`, `P3Going`, `p3/tickets/**`, `p3/you/**`) | No picture-taking walk. `walk-p3-w4a-fix3-r2` writes one fixed shot and is not mapped. |
| P3 onboarding person/page screens (`PersonFlow`, `pageModel`-driven screens) | Covered only by the broad onboarding row (`walk-p3-w4b-onboarding` + `walk-p3-golive`). `walk-p3-w4b2-page/person` take no screenshot. |
| Legacy organiser dates (`src/modules/organiser/dates/**`) | `organiser-date.spec.ts` takes no picture. |
| Organiser public page hero / page (`organiser/page/**`, `edit-in-place` other than Contact*/Team*) | `organiser-hero-owner` shoots a header element only, not the screen. |
| Public site pages (`src/pages/**`, `src/components/**`, `app/**`), `src/index.css`, `tailwind.config.*`, `index.html`, `public/**` | No mapped walk. Candidates: `contrast.phone.spec.ts` / `PUBLIC_ROUTES` could call `autoWalkShot` per route. |
| `people-nationality-flag`, `site-nav-top` (have shot env vars) | Not mapped yet: their src targets are spread across many components. |

## Next steps

1. Lead: apply the workflow diff above, with the artifact-policy count bump.
2. Add `autoWalkShot` calls to `contrast.phone.spec.ts` (one per `PUBLIC_ROUTES` entry), then map `src/pages/**` there. That is the biggest coverage gain.
3. Add a P3 dates walk (All dates + a date sheet) with `P3_WALK_DIR` shots, then map those screens.
