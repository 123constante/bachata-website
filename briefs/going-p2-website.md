# Brief: Going P2 -- Website "I'm going" module + every dancer/visitor surface (design A). Switch stays OFF.

Model: Opus. Lane: careful (multi-screen). Branch `claude/going-p2-website` from origin/main. One PR (bot-authored).
Arc plan: "ARC GOING". P1 (database) is LIVE on prod since 2026-10-23 16:58Z. This phase is Website only: no SQL, no admin repo.

## Owner decisions (binding, do not re-open)
1. Visitors see COUNT + PEOPLE for one night: "12 going" + first names; a photo only where the dancer switched it on; tap a linked person -> their dancer page.
2. Only FINISHED profiles may say going -- the database refuses (`profile_incomplete`). The screen names what is missing and links to it.
3. Going = ONE night (occurrence), never the whole series.
4. (P3, NOT this phase) organisers see who is going.
5. The switch "Show my photo when I'm going" (`show_going_photo`, OFF by default) controls the PHOTO only. Going is always NAMED (first name). No hidden option. Public dancer page "Going next" ALWAYS shows (F13 layout: 1 card full width / 2 side by side / 2 + "See all N").
6. NO "Interested" any more: one "I'm going" button. Old interested rows are never shown or written.

Design = option A "Who's going" tile: `git show origin/claude/going-p0-design:docs/design/going/option-a.html` (PR #970, docs only; README.md + `docs/going/shape-survey.md` on the same branch).
OBSOLETE in mockup A (old privacy rule): "face hidden", "N not shown", "me opted out but going", organiser "hidden" count. Redraw them as: switch OFF = listed by first name with an initials circle (no photo); hidden public page = name only, no link.

## The database interface (live)
Source of truth = admin `docs/handovers/going-p1-db.md` (sections "Refusal codes" and "Shapes"). Read it with plain git: `git clone --depth 1 https://github.com/123constante/bachata-admin` into a scratch folder, or ask nothing and use this copy:
```
set_my_going_v1(p_occurrence_id uuid, p_going boolean) -> {occurrence_id, going, changed, going_count}
get_nights_going_v1(p_occurrence_ids uuid[], p_limit int default 8) -> [{occurrence_id, going_count, people: [Person]}]   (anon OK, max 200 ids)
  Person = {dancer_profile_id: uuid|null, first_name, photo_url: text|null}
get_my_going_v1() -> {upcoming: [Night], past: [Night]}
  Night = {occurrence_id, public_event_id, event_title, occurrence_date, starts_at_local, venue_id, venue_name, event_lifecycle, night_lifecycle, is_cancelled}
get_public_dancer_extras_v1(p_profile_id) -> {bio, languages, whatsapp, going_next: [{occurrence_id, public_event_id, event_title, occurrence_date, starts_at_local}]} (max 3) or NULL when hidden
save_my_dancer_profile_v2 accepts `show_going_photo` (absent = unchanged); _my_dancer_edit_shape_v1 returns it.
```
Refusal codes (error `message`): not_signed_in, anonymous_session, invalid_argument, not_found, event_not_live, night_cancelled, night_ended, profile_incomplete, rate_limited. `starts_at_local` is London wall clock with NO zone: render as-is, never `new Date()` it. "+N more" = going_count - people.length. Link a person only when dancer_profile_id is non-null. Un-going is always allowed. Regenerate types for these RPCs or hand-type them in the module (Supabase read-only).

## What to build
1. `src/modules/going/` (new): `goingState.ts` = THE one mapping, every state -> words + control (enabled/disabled + reason) + link: signed out / anonymous session / profile unfinished (names the missing field, links to the edit screen) / can tap / going (says how to undo) / night ended / night cancelled / event not live / rate limited / error / loading. Every refusal code maps to a state. Plus `useNightGoing` (React Query: read via get_nights_going_v1 batched, write via set_my_going_v1, optimistic + rollback, invalidates the right keys), `GoingButton`, `GoingPeople` (count + up to 8 people, initials circle when photo_url is null, link only when id non-null, "+N more"). `useGoingLock` folds into it (delete the browser-only lock). One shared copy file; no surface has its own rule or words.
2. Rewire every surface to the module (all still behind the switch):
   - event page `src/modules/event-page/bento/blocks/RsvpBlock.tsx` (+ `RsvpBlockPlaceholder`, `src/modules/event-page/hooks/useOccurrenceRsvp.ts`, BentoPage wiring) = the design A tile;
   - festival hub `src/pages/FestivalHub.tsx` night rows (count + people + own button);
   - calendar list count `src/components/calendar/CalendarListView.tsx` and its data in `src/components/EventCalendar.tsx`: the owner approved this calendar change via the arc plan -- touch ONLY the going count, no density/layout change; keep the P0.5 rule (nothing shows while the switch is off);
   - dancer app Nights + Home tiles (`src/modules/dancer-app/screens/nights/*`, `screens/home/HomeScreen.tsx`, `NumbersTiles.tsx`, `screens/me/MeScreen.tsx`) and `src/pages/MyAttendance.tsx`, via get_my_going_v1;
   - public dancer page "Going next" (`PublicDancerPageV2.tsx`) from extras `going_next`;
   - settings switch "Show my photo when I'm going" with one honest line ("Your first name always shows on nights you're going to. This adds your photo.") saved through the existing profile save; an untouched save sends nothing.
3. Delete dead code: `src/components/AttendeesModal.tsx`, `src/components/EventAttendanceButtons.tsx` (prove 0 importers first), and every Website caller of `set_attendance`, `set_my_occurrence_attendance_p5_v1`, `get_my_event_attendance_v1/v2`, `get_festival_attendance*`, `get_event_attendance_counts*`. Start list: `git grep -l -E "set_attendance|set_my_occurrence_attendance_p5_v1|get_my_event_attendance_v|get_festival_attendance|get_event_attendance_counts" -- src` (includes `src/hooks/useAttendance.ts`, `src/components/profile/DancerDashboard.tsx`, `src/pages/DancerProfile.tsx`, `src/pages/Dancers.tsx`): if a caller has a non-going purpose, keep that part and say so. After this PR the Website calls NONE of the old RPCs (P5 retires them). Add a guard `scripts/check-going-legacy-rpcs.mjs` wired into `npm run lint` that fails on any of those names in `src/` (generated type files excepted), following the rules in `docs/ci-guard-notes.md` for `check-script-conventions.mjs`, with a canary.
4. Switch: `GOING_CHECKIN_ENABLED` stays false on production. Add ONE preview-only override for walks: on only when the build is a Vercel PREVIEW and `VITE_GOING_PREVIEW=1`; impossible on production (test it). Write the exact owner steps to set that env var in Vercel (Preview scope only) in the handover.
5. Contract check `scripts/check-going-rpcs.mjs` + an `npm run check:going-rpcs` script (do NOT edit `.github/workflows/*` -- your sandbox cannot; put the exact step to add to `db-contract-check.yml` in the handover): per RPC, call as anon (and as a signed-in test account only if the workflow already has one; otherwise skip with a printed reason, never a fake pass), assert the exact key sets at every level, `people.length <= p_limit`, the anon refusals, and that no caller auth uid appears.

## Design Gate stages 3-6 (this is a UI PR)
- Stage 3: tokens only from the existing token file / DESIGN.md (no new colours; no colour seam between the tile and the bento). Design record `docs/design/<pr>.md` linked in the PR body (brief, chosen option A, obsolete-state redraws, tokens used). Update DESIGN.md via the impeccable-documenter agent if available to you; otherwise say so.
- Stage 4 (self-running, in the PR): contrast >= 4.5, tap targets >= 44 px in explicit px (html font-size is ~13.5 px on phones), no clipping, no sideways scroll at 390, every empty/loading/error state actionable, every shape below rendered.
- Stages 5 (independent critique) and 6 (walk) are done by others after you: leave 390x844 screenshots of every state per surface in `docs/handover/going-p2/` for them.

## Shapes to cover (table-driven vitest: goingState x every surface x every shape; red first where you fix a bug)
Night: live / ended (with end time; no end time = open until 04:00 London next morning) / cancelled / event paused or ended / festival vs weekly series. Going 0 / 1 / 3 / 8 / 9+ (+N more) / 200. Person: photo / no photo / null id (no link). Viewer: signed out / anonymous / unfinished profile (each missing field) / finished not going / going / rate limited / network error. Dancer page going_next 0 / 1 / 2 / 3.
Real counts today (shape survey): every upcoming night has 0 going and 4 in 5 profiles are unfinished, so "0 going" and "finish your profile" are the states people will see most -- make them good.
No copy points at a control that is not on screen. Full weekday names. HTML entities for punctuation in JSX.

## Out of scope
Organiser view (P3). Turning the switch on (owner). Retiring the old RPCs in the database (P5). Any SQL. Calendar density beyond the count.

## Finish
Run every CI job step that applies (read `.github/workflows`), per-job table in the PR body, "Verified on real data" block with an honest Not verified. Handover `docs/handovers/going-p2-website.md`: what changed per surface, decisions with reasons, owner env-var steps, screenshots index, what is left.
If you run short of context, finish a coherent slice in this order -- (a) module + event page, (b) festival hub + calendar, (c) dancer app + dancer page + settings, (d) deletions + guards + contract check -- push, and emit PARTIAL with "what is left".
