# Brief: 390x844 walk of the Bristol ambassador link card (continuation of PR #1454)
Brief-version: 2

Branch: `claude/bristol-ambassador-tracker` (CONTINUATION: PR #1454 exists at head 5f6a165; fetch it, merge origin/main in, push ONCE at the end plus at most one early `[skip preview]` push). Lane: normal. Model: sonnet.

## What main lacks
- a browser walk of the ambassador link card at 390x844 on every data shape -- grep: ambassador-link-card.spec

## Scope
The tracker card (`src/modules/ambassador/link/LinkCard.tsx`, `trackerModel.ts`, mounted in `AmbassadorQueuePage.tsx`) has unit tests but was never seen in a browser. Prod has 0 ambassador rows, so use a STUBBED backend, the way `tests/e2e/helpers/organiserFake.ts` and `tests/e2e/organiser-home.spec.ts` do (page.route stubs for the Supabase RPC calls and session; read those two files first and reuse the helpers).
1. Write `tests/e2e/ambassador-link-card.spec.ts` (a name containing `ambassador-link-card.spec`). At 390x844, drive the real `/ambassador` page with stubbed `get_ambassador_link_tracker_v1` rows for each shape: {0, 1, 60 joined} x {active, switched off by the ambassador, switched off by an admin (admin_locked true), not live} plus an admin with 2 links. For each: assert the exact labels from the design record, the disabled reason text on the switch control, no sideways scroll (documentElement.scrollWidth <= 390), every tap target >= 44px, copy-link writes the exact URL (stub clipboard), and an untouched card sends no write call. Take a screenshot per shape to `walk-shots/ambassador-link-card/` (do not commit the images; attach the 6 most informative to the PR with `gh pr comment` is NOT allowed to you: instead list the file names in the handover).
2. Read each screenshot yourself; fix real layout or copy problems in LinkCard.tsx (clipping, wrapping, a disabled control with no reason, text pointing at a missing control).
3. Add the spec to the explicit `test:e2e` list in package.json only if it runs green headless with no network (stubs only); otherwise leave it out and say why.
Owner changes already applied: counts only (no names); admin_locked disables the switch-on with the reason 'An admin switched this link off. Ask an admin to turn it back on.'

## Files
- tests/e2e/ambassador-link-card.spec.ts (new), src/modules/ambassador/link/LinkCard.tsx (fixes only), package.json (maybe the test:e2e list)
- docs/handover/bristol-ambassador-tracker.md (walk results: per shape, Verified / Not verified)

## Do
Run the spec locally with Playwright (`npx playwright test tests/e2e/ambassador-link-card.spec.ts --project=chromium` or the repo's config for stub specs), plus `npx tsc --noEmit -p .` and `npx vitest run src/modules/ambassador`. Update the PR body Phone QA lines (Sizes checked: 390x844 ..., Walked: ..., Not verified: ...) and run both body checks. Push once; commit subject ends `[worker-done <ticket>]`.

## Done
Report: head SHA, shapes walked, problems found and fixed, Verified / Not verified.
