# Review: docs/briefs/instagram-refusal-r1.md (branch brief/instagram-refusal-r1)

Reviewer: cloud worker, ticket dt_14f55ad614e8, 2026-11-02. Read-only: origin/main @ 61c9706, prod `stsdtacfauprzrdebmzg` (SELECT only, counts only).

## Verdict: BLOCK

The brief targets the wrong save path. The only live screen with an Instagram box AND a Website box is the `/app` dancer editor, which saves through `save_my_dancer_profile_v2`. The brief never names v2. v2 can already clear Website and move the link in one save, so no migration is needed. Most of the screens the brief lists are not routed. Items 0 and 2 each need rewriting before dispatch.

## Findings

**F1 (BLOCK) - The live editor and v2 are missing from the brief.**
- `src/modules/dancer-app/screens/edit/EditScreen.tsx` is mounted at `/app/*` (`AnimatedRoutes.tsx:298`, `DancerAppRoutes.tsx:25`).
- It has an Instagram field (`:353`) and a Website field (`:359`), and it saves through `src/modules/dancer-app/api/rpc.ts:23,233`, which calls `save_my_dancer_profile_v2`.
- The brief names only `save_my_dancer_profile_v1` and `src/lib/saveMyDancerProfile.ts`.

**F2 (BLOCK, item 1 / move) - v2 can clear Website, and the move works in one save.**
- Prod v2 normalises `''` and JSON null to null (l.85-88).
- A null `website_url` or `instagram` skips v1 (l.203: v1 only gets a key when the value is not null). It goes to the direct UPDATE, `website_url = CASE WHEN v_dir ? 'website_url' THEN v_dir->>'website_url' ...` (l.232), so the column is cleared.
- A non-null `instagram` goes to v1 (l.222), in the same transaction.
- So `{instagram: <link>, website_url: null}` sent to v2 moves the link in one call. Admin migration: not needed.
- v1 itself cannot clear (`website_url = COALESCE(NULLIF(..,''), dp.website_url)`, v1 l.59), as the brief says. That is true but does not matter here: the move belongs in the v2 editor.
- The brief's "STOP item 1 if a blank Website cannot clear" would stop for the wrong reason. Rewrite item 1 as: "send through v2 with `website_url: null`".
- `dancerEditorPayloads.ts` / `delta.ts` must send null (or `''`) for the cleared key. Check that the delta builder does not drop it as "unchanged".

**F3 (BLOCK) - Most screens the brief names are not routed.**
- `AnimatedRoutes.tsx:202-204`: "edit-profile, onboarding, etc. retired 2026-09-12".
- No route file imports `pages/EditProfile`, `pages/Onboarding` or `pages/Profile`. `DancerDashboard` is imported only by `ProfileEntryRouter`, which is imported only by the unrouted `pages/Profile.tsx`.
- `FinishProfile.tsx`, `AuthCallback.tsx:386`, `PracticePartners.tsx:137` and `HideSurnameCard.tsx:51` never send `instagram` or `website_url`.
- `admin-organisers/join/AboutStep.tsx` and Dancer4Flow ask only the four base fields.
- No `OnboardingSheet` exists in `src/`.
- Live dancer Instagram savers on main: **only** `/app` EditScreen. Live organiser-side Instagram savers (organiser columns, not `dancer_profiles`): the p3 page "link" step (`pageModel.ts:283-286`, via `checkLink`) and edit-in-place (`draftModel.ts:269`).
- Item 2's table "every save screen x 5 cases" over dead files would be wasted, and could revive dead code.

**F4 (item 2 / refusal) - Most of the mapping already exists. The codes and the line number are wrong.**
- On v2 the first refusal is `invalid_handle` (v2 l.170-172), not `invalid_instagram`.
- `invalid_instagram` only comes from the trigger `trg_dancer_profiles_a1_contact_rule` -> `_contact_rule_value_v1` -> `normalize_instagram_handle_strict_v1` (l.19, 22023).
- `dancer-app/api/errors.ts` already maps `invalid_handle` (`:35,:77`) and `invalid_instagram` (`:39,:110` -> field `instagram`). EditScreen `placeServerError` (`:59-67`) puts the message under the field.
- **Missing: 23505.** It appears nowhere in `dancer-app/api/errors.ts`. The unique index `dancer_profiles_instagram_normalized_uidx` is live (partial, `instagram_normalized IS NOT NULL`).
- The brief cites `selfServeErrors.ts l.77` and its wording. The actual line is l.86, and the wording differs ("Use your Instagram name, like yourname or @yourname, or your profile link."). That makes four different `invalid_instagram` wordings in src (`selfServeErrors.ts:86`, `wizard/dancerApi.ts:41`, `dancer-app/api/errors.ts:39`, `organiserProfileUpdate.ts:112`).
- The brief's "one mapper, no second copy" would add a fifth.
- Rewrite item 2 as: add 23505 (on that index) to `dancer-app/api/errors.ts` -> field `instagram`, and pick ONE owner for the wording.

**F5 (item 0) - The destination claim holds for instagram, dj_answer and dj_genres, but not for city.**
- `onRow` (`OnboardingFlow.tsx:274`) sends every `elsewhere='dancer'` row, and unknown codes (`pageModel.ts:331`), to `finishProfileHref(...)`.
- `FinishProfile` checks `mode.kind === 'done'` BEFORE the gated/Dancer4 branch, so a complete base profile gets only a "Continue" button.
- `useProfileCompletion` fields are only `first_name | based_city_id | dance_role | avatar_url` (`profileCompletion.ts:20-22`). So instagram, dj_answer and dj_genres are a confirmed dead end for a base-complete person. This is a code read; it was not reproduced in a browser.
- **city is NOT a dead end:** `_onboarding_missing_v1` l.27 emits `city` exactly when `based_city_id IS NULL`, and that same fact makes `/finish-profile` show the city picker.
- Feasibility of reuse:
  - **Instagram:** reuse `/app` EditScreen (it has the field). It has no `returnTo`, so the person does not come back to the checklist. The brief must say whether to add one.
  - **DJ answer / genres:** no Dancer4 step and no `/app` field exists. The existing controls are `/account/areas` (`YourAreasPage.tsx`, `set_my_role_intent_v1` in `areas/home/rolesApi.ts:64`) and the legacy GoLiveFlow `roleQuestion.ts`. "Use the Dancer4 steps" is not feasible for these codes.
  - The p3 flow has a `teach` step but no `dj` step (`personModel.ts:8`). Adding one is the other option.
- The brief's first-step test path `src/pages/__tests__/FinishProfile.checklistRows.test.tsx`, and its assertion "an Instagram input and a DJ control", will go red. That is expected. But it tests the wrong destination once the rows point elsewhere: the matrix should be code -> destination route -> control present.

**F6 - The checklist counts Instagram from `dancer_profiles.instagram` only.**
- `_onboarding_missing_v1` l.32: `CASE WHEN NULLIF(btrim(v_dp.instagram),'') IS NULL THEN 'instagram'`. It does not read `website_url`.
- After a v2 move the column is set and the checklist counts it with no DB change. The other option is to also accept an instagram.com `website_url`. That is an admin migration (careful lane), and the brief rightly does not choose it.

**F7 - Existing rows: 43, not just Simon.**
- Prod count (non-archived): 46 rows have `website_url` matching `^(https?://)?(www\.)?instagram\.com/`.
- 43 of these have no `instagram`. 3 have both.
- Of the 43: 4 are claimed (2 with a complete base profile) and 39 are unclaimed.
- 0 would collide on the unique index if moved.
- The brief says "fixing Simon's row is a prod write". A backfill is a 43-row decision for the owner, and an admin migration if it goes ahead. Name it as a queued item.

**F8 - Missing acceptance cases.**
- base-incomplete x missing instagram: `/finish-profile` shows the form, not 'done'.
- no dancer profile (`no_profile`).
- An unknown missing code, which falls back to dancer.
- `org_city` (`elsewhere='page'`): out of scope, but say so.
- A `www.`/`m.instagram.com` link with a query or trailing slash in Website while Instagram is set to the same handle. "Same" must compare normalised handles, not raw strings.
- A Website link that is a non-profile Instagram path (`/p/`, `/reel/`): `normalize_instagram_handle_strict_v1` rejects these, so do not move them.
- The v2 `invalid_url` refusal on Website.
- A `whatsapp_not_allowed` drop alongside the move.

**F9 - Inconsistencies in the brief.**
- Item numbering is wrong. The header says "items 0, 1, 2". "Item 2 spec" is the MOVE, but the Build section's 1-4 and the dispatch note ("Item 1 worker must READ save_my_dancer_profile_v1 ... STOP item 1") call the move item 1. Renumber.
- The brief says to keep "context under 35%". The owner rule is 50%.

## Before re-dispatch
1. Retarget items 1 and 2 to `/app` EditScreen and v2 (F1-F4).
2. Item 0: Instagram row goes to `/app` edit (decide on `returnTo`). DJ rows go to `/account/areas` or a new p3 `dj` step: owner pick (F5).
3. Owner: one Instagram wording owner, and a decision on the 43-row backfill (F4, F7).

## Verified / Not verified
- Verified (code at 61c9706; prod `pg_get_functiondef` for v1, v2, `_onboarding_missing_v1`, `_contact_rule_value_v1`, `normalize_instagram_handle_strict_v1`; triggers; the index; counts): F1-F7.
- Not verified: no browser walk; the dead-end screen (F5) is from a code read only. The delta builder's handling of a null `website_url` was not read line by line. Admin-repo callers of v1 were not checked.
