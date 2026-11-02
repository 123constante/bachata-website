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
