# Brief: dancer-edit errors + "Become an organiser" beta note + photo-step words (Website, normal lane)

Branch: `claude/invite-dancer-edit` off `main` (main already has #977, merge e32b2239). One PR, bot-authored.
Dancer-app only (`src/modules/dancer-app/**` + its tests). Do NOT touch `src/modules/organiser/**` (another PR's area).

## Why (owner-facing failures)
- A dancer who types a bad phone or Instagram on the dancer edit screen gets a generic error, not "that phone / Instagram is not valid". The fix was written and split out of #977 as a patch.
- Owner walk finding 8 (2026-10-24): "Beta gate told only at the END of 'Create a new page' (after name + city). Say it up front ... (and on 'Become an organiser')." #977 fixed the organiser screens; the dancer Options row "Run events? Become an organiser" still says nothing.
- Owner walk finding 9 (part): "photo step shows 'Not now' in the header while saying it 'cannot be skipped'". The header "Not now" is correct (it keeps everything and stays signed in); the sentence is wrong.
Check that would have caught both: a table-driven test that every screen sentence matches what its controls do.

## Tasks
1. Apply `docs/handover/invite-w2-dancer-edit.patch` (on main): `git apply --3way docs/handover/invite-w2-dancer-edit.patch`. It touches 4 dancer-app files (api/errors.ts, api/types.ts, screens/edit/EditScreen.tsx, screens/me/model.ts) + 2 tests. It imports `@/lib/instagramHandle` (now on main). Resolve any drift against main; keep its tests. Then `git rm` the patch file in the same PR (it has served its purpose).
2. Fix 8: in `src/modules/dancer-app/screens/options/` under the `BECOME_ORGANISER_LABEL` row ("Run events? Become an organiser") show one short line: `During the beta, new organiser pages are approved by hand.` Use the row's existing description/sub-line slot if it has one; otherwise add one in the shared row model (one mapping, not inline JSX). Text >= 4.5 contrast, row tap target stays >= 44px. Pin it in `OptionsScreen.test.tsx`. The organiser side's wording lives in `src/modules/organiser/flows/newpage/cannotCreate.ts` (`BETA_NOTE`): do not import across modules if a module-boundary lint/test forbids it; copy the shorter sentence above.
3. Fix 9: `src/modules/dancer-app/screens/onboarding/steps.tsx` photo card `<Reason>` currently says "A photo is needed to finish setting up your page, so this step cannot be skipped." Replace with: `A photo is needed to finish your page. "Not now" at the top keeps what you have done; you can add the photo later.` Update `onboarding.test.tsx` ("the photo card cannot be skipped") so it asserts: no Continue/Skip button in the card, the sentence names "Not now", and the header "Not now" control is present (red first: write the assertion on "Not now" before changing the copy and show it fail).

## Gates
- Targeted vitest for the touched dancer-app tests, `npx tsc --noEmit`, lint, then every CI job step in `.github/workflows/*` that applies (read the files); per-job table in the PR body.
- Phone check at 390x844 of Options and the onboarding photo card (screenshots or measured rects in the PR body: no clipping, no sideways scroll, taps >= 44px).
- PR body: what changed, the 3 tasks with test names, Verified / Not verified. Design record: wording fix only, so note "Design Gate stages 4 + 6 apply (wording); stages 1-3, 5 not applicable" in the body.
