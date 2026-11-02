# instagram-refusal r2 -- handover

Branch `claude/instagram-refusal-r2` (base origin/main 61c9706). Brief r2 + r2.1 addendum.

## Commit A

Checklist (P3 onboarding Review) rows reach a place where their field can be entered.

### Data source (prod `stsdtacfauprzrdebmzg`, read-only `pg_get_functiondef`, 2026-11-02)

| Code | `_onboarding_missing_v1` reads | Who writes it (this site) |
|---|---|---|
| `instagram` | `dancer_profiles.instagram` (NULLIF btrim) of `_dancer_profile_id_for_account_v1(user)` | `/app` EditScreen -> `save_my_dancer_profile_v2` (the one live dancer Instagram saver) |
| `dj_answer` | `account_role_intent`: missing when `'dj'` is in neither `roles` nor `declined` | `answerDoYou('dj', yes)` -> `set_my_role_intent_v1` (adds `dj` to `roles`) / `set_my_role_declined_v1` (sets or lifts the decline) |
| `dj_genres` | `dj_role_details.genres` (a non-blank item) where `person_id = _dancer_profile_id_for_account_v1(user)`, only when `dj` is in `roles` and not declined | `saveMyRole('dj', {genres})` -> `save_my_role_v1`, which upserts `dj_role_details` for the SAME `_dancer_profile_id_for_account_v1` persona (list kind: trimmed, blanks dropped; `invalid_list` over 20 items or an item over 80 chars) |

So the new DJ steps write exactly the rows the checklist reads. No migration.

### Shape survey (counts only)

- `account_role_intent` rows: 16; accounts with no intent row: 32 (both = `dj_answer` missing).
- `dj` in roles: 5, of which 3 have no genres (Simon's shape, `dj_genres`); `dj` declined: 0.
- Intent rows with `dj_answer` missing: 11. Intent row with no dancer persona (no_profile): 1.
- `dj_role_details` rows: 24, only 2 with a non-blank genre; max 1 genre, max 7 chars (well inside 20 x 80).
- Claimed dancer rows with no Instagram: 7.

### Matrix (`src/modules/organiser/p3/onboarding/__tests__/reviewRows.matrix.test.tsx`)

Every REVIEW_ROWS code + an unknown code x {base-incomplete, base-complete, no_profile} -> tap the row ->
real router (`renderInShell`: real `/app/*`, real `/finish-profile` RedirectIfAllowed) -> the control for
that code. `city` x base-complete is not a real shape (a missing city is base-incomplete).

RED on the unfixed code: 12 of 57 matrix cells plus all 3 acceptance cases (15 of 60 tests):

- `instagram` x base-complete: `/finish-profile` bounced straight back to Review (Simon's "it just flashes").
- `instagram` x base-incomplete: landed on `/app/welcome` (dancer onboarding; no Instagram field).
- `instagram` x no_profile: `/finish-profile` (no field).
- `dj_answer`, `dj_genres` x all three: no DJ control anywhere (same bounce / welcome / finish-profile).
- unknown code x all three: same dead ends.
- Acceptance: Daniel's DJ row, Simon's DJ row, Simon's Instagram round trip.

GREEN after the fix: 81 of 81 (matrix + DJ flow + genres limits + new-person path + returnTo safety).
The N2 case was mutation-tested: without the Review re-read the Instagram row is still shown after save.

### What changed

- `instagram` row -> `/app/me/edit?focus=instagram&returnTo=<Review>` (`appEditHref`, sanitizeReturnTo).
  EditScreen reads `returnTo` (sanitizeReturnTo, never itself) and goes there after a save, only when
  nothing was typed after the save went out. No other change to the screen.
- N2: OnboardingFlow arriving at `at=review` reads the status with staleTime 0 and waits for that read, so
  the Instagram row is gone on return with no reload (chosen over invalidating from EditScreen: keeps the
  dancer app free of organiser imports).
- DJ steps `dj` ("Do you DJ?", yes/no via `answerDoYou('dj')`) and `djgenres` ("Music you play", free-text
  comma list, helper from fieldRegistry, 20 x 80 limits with a reason each) in personModel/PersonFlow.
  `DJ_ONLY` like `TEACH_ONLY`; reached only from Review; `personPath` and the bar for new people are
  unchanged; the last DJ step (and Back from the first) returns to Review. Simon's shape opens genres
  directly; Daniel's opens the yes/no. Untouched answers send nothing.
- Unknown codes -> an in-flow screen saying what the person can do (Edit your dancer profile, Back to your
  list). `city` unchanged (Finish profile); `org_city` unchanged (out of scope).

### Not verified / open

- Browser walk at 390x844 not done in this commit (orchestrator walk).
- `scripts/check-dancer-area-isolation.mjs` (unit-tests.yml) fails rule (a): this commit changes a file
  under `src/modules/dancer-app/` (EditScreen), which makes it a dancer-area PR, and the P3 onboarding
  files are not seams. Adding seams is an orchestrator decision (the script says so); not done here.
- Simon's exact prod account state was never reproduced.

## Commit B

An instagram.com profile link typed into Website moves to Instagram on save (owner decision 2), on the one
live dancer saver: `/app` EditScreen -> `screens/me/model.ts` buildDelta -> `api/delta.ts` diffDelta ->
`api/rpc.ts` saveMyDancerProfile -> `save_my_dancer_profile_v2`.

### Supabase proof (prod `stsdtacfauprzrdebmzg`, read-only `pg_get_functiondef` / `pg_indexes` / `pg_trigger`, 2026-11-02)

- `save_my_dancer_profile_v2`: a text key (`website_url`, `instagram`) that is JSON null or a blank string
  normalises to null; it is in the delta when it differs from the stored (btrimmed, NULLIF '') value.
  Split: a NON-null `instagram` / `website_url` goes to `save_my_dancer_profile_v1` (`c_v1_set`), a null one
  to the direct `UPDATE ... website_url = CASE WHEN v_dir ? 'website_url' THEN v_dir ->> 'website_url'`, so
  `{instagram: <name>, website_url: null}` is ONE call, ONE transaction: v1 writes Instagram, the direct
  UPDATE clears Website. (v1 alone cannot clear: `COALESCE(NULLIF(...,''), dp.website_url)`.)
- v2's own check on a changed Instagram: `normalize_instagram_handle_v1(v) !~ '^[a-z0-9._]{1,30}$'` ->
  `invalid_handle`, DETAIL `instagram`.
- Trigger `trg_dancer_profiles_a1_contact_rule` (BEFORE INSERT/UPDATE) -> `_contact_rule_value_v1('instagram')`,
  which calls `normalize_instagram_handle_strict_v1` -> `22023 invalid_instagram` (also reserved names).
- `dancer_profiles_instagram_normalized_uidx`: UNIQUE btree on `instagram_normalized` (generated:
  `normalize_instagram_handle_v1(instagram)`) WHERE NOT NULL -> a taken name is a 23505 naming that index
  (used in commit C).

No migration.

### Rule

- Move rule (N1): `instagramProfileLinkHandle(website)` in `src/lib/instagramHandle.ts` =
  `checkInstagramField(website).ok && handle !== null`, AND the value must match the module's own
  `PROFILE_LINK` (no new host list). The extra link check is a deliberate narrowing: without it a bare word
  (`simon.bachata`) or a scheme-less site (`simonbachata.com`) in Website passes `checkInstagramField` as a
  handle and would be moved. www. moves; m.instagram.com, /p/, /reel/ do not (they stay as typed).
- Only when Website changed (N6: `sameValue(stored, typed)` first). A stored link left untouched changes
  nothing; the 43 existing rows stay as they are until the queued admin backfill.
- Instagram box empty -> `{instagram: <name>, website_url: null}`; same NORMALISED name (`@Simon.Bachata`
  vs a link to `simon.bachata`) -> `{website_url: null}`; a different name -> Save blocked, under Website:
  "This looks like an Instagram link. Your Instagram is already set, so remove it here or replace your
  Instagram."
- Move FIRST, then the rules (`validateDraft` and `storedValueHints` see the moved draft); diffDelta keeps
  the null (`sameValue(link, null)` is false), so the cleared key is sent, not dropped.
- Before Save, a calm note under Website says the link will go to Instagram (or that Instagram is already
  that name). After save the form re-reads the server shape: Instagram shows the name, Website is empty.

### Tests (`src/modules/dancer-app/screens/edit/__tests__/instagramInWebsite.test.tsx`, 40)

Website {profile link, www, m., query + trailing slash + mixed case, /p/, scheme-less, https other site,
plain site, bare word, empty} x Instagram {empty, same handle, different handle} = 30 cells; N6 untouched
(Simon's stored link) sends nothing; untouched + another field sends only that field; a pure dancer's
WhatsApp key is dropped while the move is sent whole; screen: move then fields, conflict blocks with the
owner wording and sends nothing, untouched sends nothing, v2 `invalid_url` placed under Website.

Red/green: against the unfixed code (implementation stashed, test kept) 17 of 37 were RED (every move /
same / different cell for the four moving link shapes, retype-moves, the typed-box compare, the null-column
case, and both screen move/conflict tests); the m. / post / other-site / empty cells, untouched, the
WhatsApp drop and invalid_url were already green (they guard against over-moving). 40 of 40 green after
(3 bare-word cells added after the red run).

### Not verified

- No browser walk at 390x844 (orchestrator walk). No prod write; Simon's row never touched.
- A same-name link typed into an EMPTY stored Website sends nothing (Save off, "Nothing has changed yet");
  the note under Website ("Your Instagram is already this name, so it is not kept here.") deliberately
  does not mention Save. The link stays in the box until the person removes it or reloads.
