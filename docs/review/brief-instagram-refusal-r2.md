# Review: docs/briefs/instagram-refusal-r2.md (branch brief/instagram-refusal-r2)

Reviewer: cloud worker, ticket dt_ad5ad47c6dec, 2026-11-02. Read-only: origin/main @ 61c9706, prod `stsdtacfauprzrdebmzg` (SELECT / `pg_get_functiondef` / IMMUTABLE function calls on made-up strings only; counts only, no personal data).

## Verdict: PASS WITH NITS

No migration is needed for any commit. All of r1's findings are dealt with. Five nits (N1-N5) change what the builder must do. Put them into the dispatch note, or into a one-line r2.1 edit of the brief. N1 and N2 would ship visible bugs if they are skipped.

## 1. r1 findings F1-F9
| r1 | r2 | Status |
|---|---|---|
| F1 live editor / v2 | Standing header names EditScreen :353/:359, rpc.ts:23,233 | Fixed |
| F2 move in one v2 save | Commit B sends `{instagram, website_url: null}` | Fixed (re-verified, see 4) |
| F3 dead screens | Standing header: do not build on them | Fixed |
| F4 codes / 23505 / four wordings | Commit C | Fixed, see N3 and N4 |
| F5 destinations | Commit A matrix; DJ step is the owner's pick | Fixed, see N2 and N5 |
| F6 checklist reads `instagram` | Commit B, last line | Fixed |
| F7 43 rows | Owner decision 3, Queued | Fixed |
| F8 cases | Commit A and B case lists | Fixed, except the `m.` host, which is **misapplied** (N1) |
| F9 numbering, 35% | Commits A/B/C; "Context cap 50%" | Fixed |

## 2. Commit A: DJ step is feasible with existing RPCs
- The step list is `personModel.ts:8` (`PersonStep`) and `:11` (`PERSON_ORDER`). `TEACH_ONLY` (`:14`) and `personPath` (`:23-24`) handle skipping. Commands are `PersonCommand` (`:214-218`). Writes are in `personApi.ts:60-73` (`teach` -> `answerDoYou('teacher')`, `teacher` -> `saveMyRole('teacher')`). From Review, `OnboardingFlow.tsx:271-272` sends a row with a person `step` into the person flow.
- What the checklist reads (prod `_onboarding_missing_v1`):
  - `dj_answer` = `'dj'` is in neither `account_role_intent.roles` nor `.declined`.
  - `dj_genres` = `'dj'` is in `roles` and there is no non-blank `dj_role_details.genres` for the person.
- Write paths, all live on prod and all accepting `'dj'`:
  - `answerDoYou('dj', yes)` (`areas/home/rolesApi.ts:82-100`) -> `set_my_role_intent_v1` (`c_all` includes `dj`) or `set_my_role_declined_v1` (`p_role IN ('teacher','dj')`).
  - Genres: `saveMyRole('dj', {genres})` (`areas/shared/areaApi.ts:82`) -> `save_my_role_v1`. `_role_fields_v1('dj')` has `genres` of kind `list` (at most 20 items of 80 characters, diff-first).
  - The read for prefill is `my_role_details_v1('dj')`.
- **Both codes can be cleared with no migration.** What the builder adds: `'dj'` and `'djgenres'` steps, two `PersonCommand` kinds (or a `role` parameter on `teach`/`teacher`), a `dj` read in `REAL_READS` (`personApi.ts:48`), a draft field, and REVIEW_ROWS `dj_answer`/`dj_genres` getting a step (`pageModel.ts:323-324`).
- Gap: there is no genre vocabulary. `fieldRegistry.ts:49` only gives the help text ("For example Bachata, Kizomba or Salsa."). See N5.

## 3. Commit A: Instagram row to /app EditScreen
- `?focus=instagram` already works (`EditScreen.tsx:95-103` `FOCUS_IDS.instagram`, `:185-194`). Nothing to add for focus.
- There is no `returnTo` today. Save stays on the screen (`:128-135` `setSaved(true)`), and the only exit is "Back to Me" (`:420`).
  - Adding it is small: read `search.get('returnTo')`, pass it through the existing `sanitizeReturnTo` (`src/lib/authRouting.ts:8`) so it cannot be an open redirect, `navigate` to it on success, and point the back link at it.
  - The guard rules require a test that the link target is routable (`navigateTargetsRoutable.test.ts`).
- Reachability under the gate: `/app/*` -> `DancerAreaGate` (`gate/DancerAreaGate.tsx:21`) only checks `dancer_area_gate_v1`.
  - Prod flag `dancer_area_open` = **true**.
  - `save_my_dancer_profile_v2` calls `_dancer_area_require_v1` (also true for everyone).
  - None of v1, v2, `my_dancer_edit_v1`, `save_my_role_v1` or `set_my_role_*_v1` call `_require_onboarding_complete_v1` or `_require_onboarding_for_door_v1`.
  - No client code reads `organiser_onboarding_gate`.
  - **So nothing bounces a person who is mid-onboarding** (`organiser_onboarding_gate` is ON).

## 4. Commit B: the delta does reach v2
- The live builder is **`dancer-app/screens/me/model.ts:248` `buildDelta`** + `api/delta.ts:41` `diffDelta`.
- `src/lib/dancerEditorPayloads.ts`, which the brief names, is imported only by the dead `components/profile/DancerDashboard.tsx` (r1 F3). Do not edit it. That is a wrong path in the brief.
- A cleared Website: `text('')` -> `null` (`model.ts:222`). `sameValue(stored, null)` is false (`delta.ts:27-31`), so `out.website_url = null` is kept. `JSON.stringify` keeps null. `rpc.ts:182` sends `{p_payload: delta}`. `dropWhatsappIfNotAllowed` only removes whatsapp keys.
- The Instagram value goes through `instagramValue` -> `checkInstagramField(...).handle`, so the bare handle is sent and not the link (`model.ts:225-233`). That is fine.
- Prod v2 re-read: `website_url = CASE WHEN v_dir ? 'website_url' THEN v_dir ->> 'website_url' ...` (direct UPDATE). `instagram` goes through `save_my_dancer_profile_v1(v_v1)` in the same call. **Confirmed.**
- Prod shapes of the 46 instagram.com Website values (non-archived):
  - every one has `https://`;
  - every one has `www.`;
  - 0 have `m.`;
  - 42 have a query string (`?igsh=` style);
  - 0 are `/p/` or `/reel/` links.
- Owner decision 2 holds with no DB change.

## 5. Commit C: what a 23505 looks like
- No `EXCEPTION`/unique handler exists in v1, and v2's only `EXCEPTION WHEN OTHERS` wraps the revalidation emit. So the raw PostgREST error reaches the client: `code: '23505'`, `message: 'duplicate key value violates unique constraint "dancer_profiles_instagram_normalized_uidx"'`, `details: 'Key (instagram_normalized)=(...) already exists.'`.
- The index is live: `UNIQUE (instagram_normalized) WHERE instagram_normalized IS NOT NULL`. The other unique indexes on the table are `slug`, `cross_claim` and the pkey. See N3 for the catch.

## 6. Findings
**N1 (misapplied F8, would ship a refusal) - `m.instagram.com` is not a movable profile link.**
- The brief says "host instagram.com, www., m. ... accepted by normalize_instagram_handle_strict_v1".
- The server rejects it. Prod `normalize_instagram_handle_v1('https://m.instagram.com/some.name')` = `'https:'`, which fails the strict regex and gives `invalid_instagram`.
- The client also rejects it on purpose: `lib/instagramHandle.ts:69` `PROFILE_LINK` is `(www\.)?` only, and the `:77-79` comment says "m.instagram.com/x ... is refused here".
- Prod has 0 such rows.
- Fix: the move rule is exactly `checkInstagramField(website).ok && handle !== null`. That reuses the ONE client rule and does not hand-roll a host list. `m.` is not moved and is a test case of its own.
- Also: `validateDraft` (`model.ts:186`) refuses a Website with no scheme (`instagram.com/x`) before any move. Decide the order: move first, then validate. Add a case for it.

**N2 (would ship the original symptom) - the checklist is stale for 60 seconds after the EditScreen save.**
- The EditScreen save only calls `setQueryData(myDancerEdit)` (`api/useMyDancerEdit.ts:38`).
- Back at `?at=review`, `OnboardingFlow.tsx:119` starts on Review, and `status` (`:135`, key `['p3-ob-status', orgId]`) is served from cache under the global 60 s `staleTime` (`App.tsx:50`).
- So "Your Instagram: To do" still shows right after a good save. That is the "no response" Simon described.
- Fix (Commit A): on a save that came with `returnTo`, invalidate `PERSON_STALE_KEYS` (`personApi.ts:76`, which has `p3-ob-status`). Or have Review refetch status when it mounts from `at=review`.
- Add an acceptance case: save -> return -> the row is gone with no reload.

**N3 - `error.code` is thrown away. Match on the index name in the message.**
- `api/rpc.ts:37` builds `DancerApiError(codeFromMessage(error.message), error.message, details)`. PostgREST's `code` ('23505') is never kept.
- `codeFromMessage` (`errors.ts:151-161`) matches code words in the message. The message has the index name and not "23505".
- So "Add 23505 on that index" has to be done by either:
  - (a) a new code, e.g. `instagram_taken`, matched on `dancer_profiles_instagram_normalized_uidx` in the message; or
  - (b) passing `error.code` through `call()`.
- (a) is smaller. Whichever is chosen, test it through the real `call()` with a PostgREST-shaped error `{code, message, details}`, not a hand-built `DancerApiError`. A `slug_uidx` 23505 must stay `unknown` (top error).

**N4 - "set its invalid wording to the owner's text" hits a shared code.**
- `invalid_handle` is a per-field DETAIL_COPY used by Facebook too (`errors.ts:77`). `placeServerError` also gives `invalid_handle` to both handle fields (`EditScreen.tsx:64-65`).
- Change the wording for `invalid_instagram` and for the `instagram`-detail variant of `invalid_handle` only.
- The client-side `checkInstagramField` messages (`INSTAGRAM_PROBLEM_COPY`, `INSTAGRAM_NOT_PROFILE_LINK`) are what the person sees first, since validation runs before Save. Say whether they also take the owner's invalid text. As written, they don't.
- Add a test: a Facebook `invalid_handle` still says Facebook.

**N5 - where the DJ step sits is not stated.**
- If `dj` joins `PERSON_ORDER` it is on every new person's path. The bar percent and `groups(personPath(...))` (`OnboardingFlow.tsx:263`) change, and `personPath` needs a `DJ_ONLY`, like `TEACH_ONLY`, for genres.
- Going `{kind:'person', step}` from Review walks FORWARD along the path (`PersonFlow.tsx:223,240`), not back to Review. So "returns to the checklist" is only true if `dj` is placed last, or if the step is told to return.
- The brief must state:
  - on the main path or only from Review;
  - after which step;
  - free-text list or chips for genres, with a list named if chips (none exists).
- Add an acceptance case: Simon's shape (`dj` in roles, no genres) opens genres directly, not the yes/no.

**N6 (minor) - a stored link is not covered.** All 43 rows already have the link in Website. The brief says "typed". Say whether a save that leaves Website untouched moves a stored link. If it does, the 43 rows get changed by people editing their own profiles, which may or may not fit owner decision 3. Recommend: move only when `website_url` is in the delta, plus a fixture for an untouched stored link.

## Verified / Not verified
- Verified:
  - Code at 61c9706 (every file:line above).
  - Prod definitions: `_onboarding_missing_v1`, `set_my_role_intent_v1`, `set_my_role_declined_v1`, `save_my_role_v1`, `my_role_details_v1`, `_role_fields_v1('dj')`, the v2 lines, v1 (no exception handler), `normalize_instagram_handle_strict_v1`, `normalize_instagram_handle_v1` on made-up strings, `dancer_area_gate_v1` / `_dancer_area_allowed_v1`, the flags, the unique indexes.
  - Counts of Website shapes.
- Not verified:
  - No browser walk.
  - The PostgREST 23505 JSON shape is the documented standard; it was not triggered on prod (that would need a write).
  - The 60 s staleness (N2) is from reading the code, not reproduced.
  - Simon's exact account state was not looked up (no personal data read).
