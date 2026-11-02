# BRIEF r2: checklist rows reach their field; Instagram moves out of Website; Instagram refusals explained

Supersedes instagram-refusal-r1 (independent review BLOCK, docs/review/brief-instagram-refusal-r1.md on claude/review-brief-instagram-r1; every finding F1-F9 is addressed below).
Lane: careful (save path), Opus builder, Website only, NO migration, NO prod write. Branch claude/instagram-refusal-r2, three commits (A, B, C), ONE push.

## Why (owner words and evidence)
Simon (Bachata Influence, claimed dancer) on WhatsApp: "i couldnt type anything", "i click on the thing and it just flashes", "and no response". His Instagram link is stored in dancer_profiles.website_url; instagram is NULL; checklist still says "Your Instagram: To do". 46 live dancer rows have an instagram.com link in Website (43 with no Instagram set; 4 of those claimed, 39 unclaimed).
Code read (not browser-reproduced): checklist rows with elsewhere='dancer' (instagram, dj_answer, dj_genres, unknown codes) navigate to /finish-profile; for a person whose base profile is complete that screen is mode 'done' (Continue button only). city is NOT a dead end (its missing code means the city picker shows).

## Owner decisions (binding, 2026-11-02)
1. DJ rows (dj_answer, dj_genres) get a NEW DJ step inside the onboarding flow beside the Teach step (p3/onboarding personModel/PersonFlow), returning to the checklist.
2. If an instagram.com link is typed into Website, the app moves it into Instagram and clears Website; the checklist then counts it.
3. Existing 43 rows: QUEUED, not in this brief (separate reviewed admin migration, owner approves later). Do not touch any real row.
4. Refusal wording (use exactly): invalid = "Enter your Instagram handle (like @yourname) or a full instagram.com link."; taken = "That Instagram is already on another profile. Check the spelling, or message us if it is yours."

## Standing header
- Prove the data source first: read save_my_dancer_profile_v2, v1, _onboarding_missing_v1, the dancer_profiles triggers read-only on prod (Supabase read-only, no writes); state which column each checklist code reads and who writes it.
- Live Instagram savers (reviewer, code at 61c9706): dancer = ONLY /app EditScreen (src/modules/dancer-app/screens/edit/EditScreen.tsx, Instagram :353, Website :359, saves via dancer-app/api/rpc.ts:23,233 -> save_my_dancer_profile_v2). Do NOT build on pages/EditProfile, Onboarding, Profile, DancerDashboard, FinishProfile for Instagram (unrouted or never send instagram; do not revive dead code). Prove an importer before editing any file.
- Zero bytes to the /app first load: npm run check:bundle-budget on main and branch (the EditScreen is under /app: measure); never edit perf-budgets.json or vite.config.ts.
- Stopping rule: one independent review, one fix round, then the orchestrator walk. Context cap 50%.
- Not touching: calendar-excluded files, supabase/migrations (a needed migration = stop and report).

## Commit A: checklist rows reach a place where the field can be entered
FIRST write the matrix test (red first, report red/green in the handover): for every code in REVIEW_ROWS (+ an unknown code) x person state {base-incomplete, base-complete, no_profile} -> destination route -> the control for THAT code is present. Today's red cells: instagram, dj_answer, dj_genres, unknown code for base-complete.
- instagram row -> the /app edit screen on the Instagram field, with a returnTo so Save returns to the checklist (decide how: add returnTo support to EditScreen; keep it tiny; no change to the screen otherwise).
- dj_answer / dj_genres -> NEW DJ step in the person flow beside `teach` (personModel.ts:8 step list; save through the existing person save path; DJ data lives where _onboarding_missing_v1 reads it: prove it). Returns to the checklist when done. Question wording: reuse the Teach step's pattern ("Do you DJ?", then music you play).
- unknown codes: stay on a screen that says what the person CAN do (never a dead Continue).
- city: unchanged (not a dead end). org_city (elsewhere='page'): out of scope.
- Acceptance cases: base-incomplete x missing instagram (/finish-profile shows the form), base-complete x each code, no_profile, unknown code, Daniel's shape (missing teach_answer, dj_answer, contact_confirm), Simon's shape (missing instagram, dj_genres).

## Commit B: Instagram link typed into Website moves to Instagram (on /app EditScreen via v2)
- Verified by review: v2 normalises '' and null to null; a null website_url clears the column (direct UPDATE l.232); a non-null instagram goes to v1 in the same transaction. So send {instagram: <link>, website_url: null} in ONE v2 save. No migration.
- Rule: Website value is an instagram.com PROFILE link (host instagram.com, www., m.; handle path accepted by normalize_instagram_handle_strict_v1; query string and trailing slash allowed; /p/ /reel/ style paths are NOT profile links: do not move) AND Instagram box empty -> move. If Instagram already holds the SAME normalised handle -> just clear Website. If it holds a DIFFERENT handle -> block the save with a message under Website ("This looks like an Instagram link. Your Instagram is already set, so remove it here or replace your Instagram."). Compare NORMALISED handles, not raw strings.
- Check dancerEditorPayloads.ts / delta.ts: the delta builder must send null for the cleared key and not drop it as unchanged (reviewer did not read it line by line).
- Table-driven tests: website value x instagram value ({empty, same handle, different handle} x {profile link, www, m., query/trailing slash, /p/ link, https non-instagram, plain site, empty}); untouched save sends nothing; also v2 invalid_url on Website and a whatsapp_not_allowed drop alongside the move.
- The checklist counts it with no DB change (_onboarding_missing_v1 reads dancer_profiles.instagram).

## Commit C: Instagram refusals explained on the live screen
- v2 refusals: invalid_handle (v2 first refusal), invalid_instagram (trigger 22023), and unique violation 23505 on dancer_profiles_instagram_normalized_uidx.
- dancer-app/api/errors.ts ALREADY maps invalid_handle (:35,:77) and invalid_instagram (:39,:110 -> field instagram), and EditScreen placeServerError (:59-67) puts the message under the field. MISSING: 23505. Add 23505 on that index -> field instagram, the owner's "taken" wording. Do not add a fifth mapper: there are four invalid_instagram wordings (selfServeErrors.ts:86, wizard/dancerApi.ts:41, dancer-app/api/errors.ts:39, organiserProfileUpdate.ts:112). dancer-app/api/errors.ts is the ONE owner for the dancer path; set its invalid wording to the owner's text. Do not rewrite the others; list them in the PR as follow-up.
- Tests: error code x message under the Instagram field; 23505 on any other index is NOT shown as the Instagram message; untouched save sends nothing.

## Walk and real-data block
390x844 walk of /app edit (move, same, different, taken fixture) and the checklist rows on the laptop (walk-all / laptop-walk) with fixtures, no prod write. PR body: Verified / Not verified (state that Simon's exact account state was never reproduced on prod).

## Queued, NOT in this brief
Backfill of the 43 existing rows (reviewed admin migration, owner approval). Four different invalid_instagram wordings to unify. Empty Instagram box cannot clear a stored value on v1 (side note only).
