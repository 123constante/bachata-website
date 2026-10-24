# ARC: organiser events rebuild on ONE rule set (admin = truth), 2026-10-21

Supersedes `arc-organiser-events-rebuild-2026-10-21.md` (depth B kept; rules below replace its design).

## Context
Owner: the admin event editor has the rules right, the Website does not. Example: the Website asks for a start time, but time must come from the first session. Owner wants a professional events area and one rule set for admin and Website. Facts read 2026-10-21:
- Admin derives start/length from the programme (`components/events/editor-v2/save/buildSeriesPayload.ts` via `lib/classCreateFlowHelpers.ts` `deriveSpanFromProgramTree`); the server trigger `_p5_sync_series_default_times_v1` keeps the series time = MIN(session start).
- The Website asks for the time on its own in `flows/new` (Time step, `NEW_EVENT_START_TIME='20:00'`), Details "Time" (`events/eventModel.ts:369`), and `flows/change/Time.tsx`. This is the source of the made-up "8:00 PM-1:00 AM" (admin `docs/audits/sessionless-date-time-2026-10-09.md`).
- Category/type: the server already derives it from sessions (event-truth P2); the Website no longer sends it.
- Payment: 67 live = 51 ticket link, 3 passes, 16 nothing; `payment_methods` column exists, the public page reads it (`buildEventPageModel.ts:256`), but it is NOT in `OWNER_UPSERT_KEYS` and admin never writes it.
- Prod shapes: live 67 (18 with no coming date), ended 21, paused 2, draft 1, archived 82; formats recurring/one_off/course/festival.
- "Add a date: Not found" on zz test 2: that row is now archived; cause not reproduced (client lookup `flows/add/addModel.ts` findSeries).

## Rule sheet (owner answers, click questions 2026-10-21)
1. Time = sessions only: start = earliest session start, end = latest session end. No start-time field anywhere.
2. Source of truth = admin editor; ONE rule set for admin and Website (admin keeps its extra powers: featured, convert, delete, festival).
3. Create needs: name, format (Weekly / One-off / Course = first date + number of weeks), venue, first date, first session (admin's session fields: type, name, start-end, length, level, line-up asked in the same sheet, search existing profiles only), flyer, How to pay (at least one: Ticket link / Pay at the door / Bank transfer beforehand ("message the organiser for details", no bank numbers) / Cash / Free).
4. Create = Publish (live at once); a quieter "Save as draft". Drafts can be deleted; live events only paused/ended.
5. Weekly: the first date sets the weekday; open-ended; "Stop repeating" any time.
6. Event type comes from the sessions, never asked.
7. Editing a live event = change several things, then ONE "Update live event". Series changes apply to every coming date except dates with their own changes; the button says the count ("Updates 12 coming dates. 2 dates with their own changes keep them."). One date = open that date. (Claude's pick; owner said "whichever is more intuitive".)
8. One date's time = shift all its sessions (admin date drawer).
9. Cancel a date = with a reason, stays visible as Cancelled. Remove "Take this date off". Bulk (cancel and move several) stays as today.
10. Publish blockers (disabled with a reason): every first date has a session; first date in the future; session times valid (end after start, or next day). No double-booking check.
11. Optional details: description + music-style chips, gallery + video, level per class. No group chat link.
12. Existing 16 live events without payment stay live; their page shows "Add how to pay" until done.
13. Enforcement in screens (B) plus ONE server change: let owners save `payment_methods`. Existing series whose stored time disagrees with sessions: count read-only and report; change nothing.
14. Formats this release: Weekly, One-off, Course AND Festival.
15. Festival = start date + number of days; ticket link only (no pass editor). Each day needs its party hours (one Party session per day, "Same every night" on by default); public page lists each day's party hours. Workshop timetable OPTIONAL, added any time (also after Go live). One festival artist list (search people, role Teacher / DJ / Performer) shown as the line-up. Prod: 7 live festivals, median 6 sessions over 4 days, max 14; existing timetables kept. Storage for the artist list: AD1 worker checks the existing structures first (`organiser_series_cast_v1`, `festival_meta`, event_program_people on an untimed item); a new column/table only if none fits (then it joins the AD1 migration).
16. Rollout behind a switch: owner's own pages first, then all organisers; old screens deleted only after the switch is on for everyone.
17. Desktop layout designed too (not just stretched phone). Organiser look sits on the site's graphite ground (S13 arc, PRs #883-#893); no files shared with the People arc.
18. Public side in scope: event page AND calendar show the new facts (payment choices, cancelled + reason, level, times from sessions, festival party hours per day). Calendar files on the exclusion list: owner allowed CONTENT changes only, never layout/density.
19. Not now: Duplicate event, follower notifications, double-booking check, funnel counting.
20. (Owner 2026-10-21 after D0) Style = **C. Monzo** (bold cards, chunky type, one coral pill per step) on the graphite ground. Mockup: https://claude.ai/artifact/QJMuZf4XoSh7wpU2myGyzA
21. Sessions are entered as **Start + End**, never a length. End picker lists only times after the start (wrapping past midnight, marked "next day"), so an invalid pair cannot be chosen. Admin's length column stays admin-only display.
22. Create asks for **one or more** sessions: "Add another session" (most nights have 2+, e.g. Class 20:00-21:00 then Party 21:00-02:00). A new session starts where the previous one ends; sessions are listed in time order; each has type, start, end, level (classes/workshops) and line-up.
23. Density: roomy Monzo cards for the create steps, compact rows for event page / dates / Home lists. Ground: graphite. Colour + font: owner comparing on https://claude.ai/artifact/AppmjABMJD8zTnaQ23di59 (amber, soft gold, ember, coral, rose, mint; Inter / Outfit). Site DESIGN.md says amber + Inter (One Frequency Rule): an off-brand pick means changing that rule for the organiser area and recording it in DESIGN.md.
24. (Owner 2026-10-21 08:15) Colour = **Ember #f0703a** (ink #1d0a03), font = **Outfit**, for the organiser area. Off the amber/Inter rule: record in DESIGN.md as an organiser-area world (like bento/venue worlds), scoped to `src/modules/organiser/**`.
25. Editing a session shows ALL its fields (type, start, end, level, line-up, remove), same component as create; event page has "+ Add a session".
27. Session kinds = admin's six: Class, Workshop, Masterclass, Party, Showcase (stored type `performance`, section `showcase`), Competition (admin `EventEditor.tsx` IMPORT_KIND_MAP, `ProgramPanel.tsx` defaultItemTypeForKind). Level only on Class + Masterclass (admin rule, DateCapsule.tsx:137). Line-up label per kind: teacher / DJ / performer / judge. Prod counts: party 365, class 272, masterclass 19, workshop 2, performance 2, competition 1, legacy `show` 1.
28. Lessons (Class / Workshop / Masterclass) get quick lengths `45 min | 1 h | 1 h 30 | 2 h | Other` (default 1 h); the end is still shown as a time; Other opens the end-time list. Party / Showcase / Competition keep start + end lists. Prod 2026-10-21: 45/60/90/120 = 220 of ~270 classes; 9 classes stored with impossible lengths (540-1260 min) = the read-only report also lists these (no change without the owner).
29. New venue (owner 2026-10-21): organisers may "Add a new venue" = name + postcode (address + map pin from the postcode; UK postcode lookup, e.g. postcodes.io, no key). Created as a DRAFT venue usable on their event at once; no public venue page until the owner publishes it in admin. Today only admin super users can create venues (`upsert_venue_atomic` checks admin_super_users); prod 66 venues (24 published, 31 dancer_ready, 11 draft), all with lat/lng. Needs an owner-callable create RPC in the AD1 migration (rate-limited, sets publish_state='draft', user_id=caller). Duplicates, 4 layers: (1) "Add a new venue" only under search results, prefilled with the typed name; (2) on postcode, show venues at that postcode or with a similar name: "Is it one of these?", must tap "No, it's a new venue"; (3) server refuses exact name+postcode duplicates and returns the existing venue; (4) admin review queue + merge.
26. Festival nights: no "same every night" switch. Every night is listed with its own hours; tap a night to change it; the open night offers "Use these hours every night". Default 22:00-04:00.

## How "one rule set" works without server enforcement
`event-rules.json` (rules + messages + shape fixtures) lives in BOTH repos, byte-identical, with a CI compare step in each (same pattern as the day-rollover mirror, CI #8). Website `src/modules/organiser/shared/eventRules.ts` and admin `lib/eventRules.ts` are thin readers of it, and both run the same fixture table.

## PRs and slices (cloud workers only; author Sonnet, review Opus; ONE push per slice; brief files on `arc/briefs-organiser-r1` under `docs/organiser-rebuild/briefs/ER-*.md`)
- **Admin PR (AD1)**: migration (version from `next-migration-version.mjs reserve 1 --for "ER AD1"`) adding `payment_methods` to the owner upsert + create keys (re-pin the allowlist guard md5s); `payment_methods` value = comma list of codes `ticket_link,door,bank_transfer,cash,free`; admin editor gets the "How to pay" choices and requires a session at create; `lib/eventRules.ts` + `event-rules.json` + CI compare.
- **Website PR, sliced:**
  - **ER-S1 rules + lookup** (first, alone): `event-rules.json`, `shared/eventRules.ts` (readiness, blockers, payment codes, time from sessions), `useOrganiserSeries(id)` replacing the 3 `allSeries/findSeries` copies (flows/add, flows/change, events/eventsApi); table-driven tests over the prod shapes above; red-first Not-found repro on a 0-date draft. This pins the interface for S2-S4.
  - **ER-S2 New event** (`flows/new/**`): steps from rule 3, Publish + Save as draft, no time step.
  - **ER-S3 Event page** (`events/**`, `dates/**`): draft checklist, "Update live event" with the scope count, date drawer shift-sessions, cancel with reason, remove Take this date off and the Details Time row, delete drafts, "Add how to pay" nudge.
  - **ER-S5 Festival** (`events/festival/**` new dir): create days + party hours, "Same every night", optional timetable with Copy a day, artist list.
  - **ER-S6 Public facts** (`src/modules/event-page/**`, calendar content only): payment line, cancelled + reason, level, festival party hours per day, "Timetable coming soon".
  - **ER-S0 switch** (inside ER-S1): one flag read in `shell/OrganiserRoutes.tsx`, on for an allowlist of organiser ids first.
  - **ER-S4 Home + retire flows** (`home/**`, `jobs/**`, `flows/add/**`, `flows/change/Time.tsx`, take-off flow): the same readiness text, Not-found states split (loading / archived / no access).
- Per slice: author (+ continuation if PARTIAL) -> Opus review on the branch before PR -> ONE fix pass. Every brief: plain git (no `gh api`), no shell variables/loops, `npm run build`, every CI job step run in the sandbox (billing rule), 30% context relay.

## Design phase FIRST (owner 2026-10-21: premium, foolproof, no unneeded text)
Design bar: one primary action per screen; pickers allow only valid values (end after start, future dates, existing venues, search-only people), so error text is never needed; a control that cannot work is disabled with a 2-4 word reason; no helper paragraphs; full weekday names; explicit px tap targets (13.5px root font trap).
- **D0 style pick (now, right after approval):** ONE private Artifact page holding three tap-through 390x844 mockups of the SAME screens (New event steps: name -> format -> venue -> first date -> first session + line-up -> flyer -> How to pay -> Publish; then the live event page and Update live event). Style A Apple (plain grouped lists, native-feel pickers), style B Airbnb (one question per screen, big type, progress bar), style C Monzo (bold cards, one-tap actions). Example data, clearly marked.
- **D1 full prototype** in the chosen style: every screen and state (draft, live, live with no coming date, paused, ended, no payment, cancelled date, bulk, delete draft, Update count). Owner taps it on the phone and approves. The approved prototype file goes on the briefs branch and every Website brief builds to it (screens must match it).
- No worker is dispatched before D1 is approved.
- **Tools (owner 2026-10-21):** D0 uses the `frontend-design` skill (direction for the 3 styles); D1 uses `impeccable` (shape the prototype, then record the approved look as an organiser-only DESIGN.md: read the untracked `C:\dev\Website\DESIGN.md` first, never overwrite it blind; the organiser rules go in their own section/file scoped to `src/modules/organiser/**`). Every Website brief says: read DESIGN.md + the prototype; match them.
- **Design gate before every Website PR:** after the code review, an impeccable finish review (cloud worker, different from the author) compares 390x844 screenshots of the slice to the approved prototype and DESIGN.md; mismatches go into the SAME single fix pass. First worker checks impeccable is available in the cloud env; if not, the reviewer follows the impeccable finish-review checklist copied into the brief.

## Order
1. After D1 approval: reserve the migration version; write briefs AD1 + ER-S1; dispatch both (disjoint repos).
2. On ER-S1 DONE + review: dispatch ER-S2, ER-S3, ER-S4 in parallel (disjoint dirs, two workers at a time max).
3. Integrate on `claude/er-integrate`, run every CI step, 390x844 walk on prod-shaped data (live with no coming date, draft, paused, ended, no payment).
4. Read-only report: series where `default_local_start_time` != MIN(session start).
5. One review pack (Verified / Not verified, decisions incl. rule 7 pick and the rules-file mirror), then the merge train: AD1 apply on prod -> check -> Website PR.

## HANDOVER 2026-10-21 ~08:35Z (session hit the 30% context warning)
- Done: rule sheet 1-29 (owner click answers). Style mockup (A/B/C) https://claude.ai/artifact/QJMuZf4XoSh7wpU2myGyzA -> owner chose Monzo. Colour/flow mockup https://claude.ai/artifact/AppmjABMJD8zTnaQ23di59 (v4: Ember + Outfit, start/end sessions, several sessions, six kinds, lesson quick lengths, festival nights list, full Edit session). Source: C:\Users\ecual\AppData\Local\Temp\claude\C--dev-Website\f2a441f2-a833-40f0-b91a-3017cb1d774e\scratchpad\organiser-colour-pick.html (copied to C:\Users\ecual\.claude\plans\organiser-rebuild-mockups\ with the two earlier mockups; put them on the briefs branch with the first batched commit). Owner: "Everything is looking good".
- Not done: venue screens not yet in the mockup (rule 29); D1 full prototype (every screen/state + desktop) not started; DESIGN.md organiser world not written; no briefs, no workers, no migration version reserved.
- Not this session's: hook nags about workers dt_b42abe7dcec8 / dt_2fad189bdb4f / dt_6d2f4e67a62f belong to another session.
- NEXT-SESSION PROMPT: "Read ~/.claude/plans/read-claude-plans-organiser-r1-admin-par-crispy-bengio.md (rules 1-29 + HANDOVER 2026-10-21). Copy the mockup source from the scratchpad path into the briefs branch. Add the venue step (search, Add a new venue, postcode, 'Is it one of these?') to the mockup and show the owner. Then build D1, the full prototype in the Monzo/Ember/Outfit look (every screen and state, desktop too) with impeccable, get owner approval, then write the organiser DESIGN.md world, reserve the AD1 migration version and write briefs AD1 + ER-S1."

## Verification
Shared fixture table green in both repos, and the CI compare red when one copy is changed (mutation). Red-first tests for: no time input anywhere (grep test), publish disabled with each blocker, Not-found repro, untouched save sends nothing. Production build. 390x844 walk of create -> publish, edit live -> Update, cancel a date, delete a draft. Real phone = owner's final check only.

## PROGRESS 2026-10-21 (session 33216b94)
- Venue step (rule 29) added to the colour/flow mockup: https://claude.ai/artifact/AppmjABMJD8zTnaQ23di59 (v5). Search -> "+ Add a new venue" only once 2+ letters are typed (name prefilled) -> name + postcode -> "Is it one of these?" (same postcode or a shared name word; must tap a venue or "No, it's a new venue") -> map pin + area -> "Add venue" (an exact name+postcode match picks the existing venue).
- Owner picks (click questions): DESKTOP = two panes (events list left, chosen event right; New event steps left + live "How dancers will see it" preview right). HOME = "Needs you" first (draft / no way to pay / no coming dates), then Live, then Paused and ended.
- D1 prototype v1 published: https://claude.ai/artifact/6zQZeapwq45Vs9kwnbdzcC (source ~/.claude/plans/organiser-rebuild-mockups/organiser-prototype.html). 30 jump states x phone + computer, no script errors; impeccable detector: 1 false positive (assumed a white background).
- Claude's picks inside D1 (owner can overrule): weekly "Stop repeating" = pick the last night; a date with its own times is tagged "Own times"; cancel reasons = Venue unavailable / Illness / Bank holiday / Other (free text); a live event with no payment says "Ask the organiser" until it is added; edits to a paused event say "Save changes" instead of "Update live event"; date edits save per date at once (not pending).
- NEXT: owner approves D1 (or lists changes) -> write organiser DESIGN.md world (read the untracked C:\dev\Website\DESIGN.md first) -> reserve AD1 migration version -> briefs AD1 + ER-S1 -> dispatch.

## D1 DEEP-CHECK GAPS 2026-10-21 (owner: "I should not have to tell you what is missing")
Checked against: rules 1-29, admin editor-v2 (DetailsPanel, ProgramPanel, DateCapsule, OccurrenceDateDrawer, DateCancellationCard, lib/cancellationReasons.ts), Website organiser on origin/main (OWNER_UPSERT_KEYS, events/*, dates/*, flows/change/*), public buildEventPageModel.
Missing/wrong in D1 v1 (all go into v2):
- Sessions: NAME (rule 3; admin requires a title, default per kind), ROOM (optional; admin has it), LEVELS multi (Website has several levels), line-up = SEARCH existing profiles + Recent (v1 used a dropdown), workshops in the festival timetable use the same full session card.
- One date (admin drawer + Website dates/*): sessions and line-up for this date only, add a session to this date only, different venue this date only, copy changes from another date, one-off: move to another day; tag "Own changes".
- Event: rename (name row), description + music styles + photos + video as real editors AND an optional create step, co-organisers ("Organisers", link an organiser page; admin + Website SeriesOrganisers), "See it live", "+ Add a date" always, venue change uses the same search + Add a new venue, flyer change sheet with upload state.
- Festival: How to pay = ticket link only (rule 15; v1 offered all five), add/remove a day.
- Cancel reasons must be the SERVER list (Venue closed / Teacher unavailable / Bank holiday / Low signups / Other), no free text (owner 2026-10-09). v1 invented its own list + free text.
- No-payment copy: v1 invented "Ask the organiser"; public page simply shows no payment line until added.
- Bulk move: time AND venue.
- Public side (rule 18) had NO screens: public event page (payment line, times from sessions, level, cancelled + reason, festival party hours per day, artists, "Timetable coming soon") + calendar day row; content only, public layout unchanged.
- States: loading, not found split (archived / no access / gone), update failed (offline) with retry, leaving with unsaved changes.
Owner decisions 2026-10-21: price list DROPPED (no prices editor anywhere; festivals ticket link only). Event Instagram link DROPPED. Stored values are left untouched (no prod write); briefs must say the editors go and the public page behaviour for existing stored values is decided in ER-S6 (default: keep showing what is stored).
Out of this arc (not touched): promo codes, guest list, attendance, promotion log, featured, convert, restore ended (admin only).

## HANDOVER 2026-10-21 (session 33216b94, hit the 30% warning)
- D1 v2 published (same link): https://claude.ai/artifact/6zQZeapwq45Vs9kwnbdzcC . Covers every item in "D1 DEEP-CHECK GAPS" above; 59 jump states x phone + computer, no script errors; click-throughs verified: line-up search add, own line-up on one date + save, one-off move day, new venue from the event page, update failed then retry, festival create (ticket link only), public page.
- v2 Claude picks (owner may overrule): line-up "Recent" = last 3 people used; a level must keep at least one chip; date sheet holds time shift + venue + sessions + copy-from in ONE sheet with ONE "Save this date"; one-off "Cancel the event" replaces Cancel this date; leaving a live event with pending changes asks "Update before you leave?"; public no-payment = no payment line at all.
- Known prototype limits (not product decisions): pending-change prompt only on the phone back button (desktop switching events does not ask); people/venue/org search is a fixed example list.
- NEXT-SESSION PROMPT: "Read ~/.claude/plans/read-claude-plans-organiser-r1-admin-par-crispy-bengio.md (rules 1-29, D1 DEEP-CHECK GAPS, last HANDOVER). Wait for the owner's verdict on D1 v2 (https://claude.ai/artifact/6zQZeapwq45Vs9kwnbdzcC); apply any changes with the same deep check (rules + admin editor-v2 + Website organiser on origin/main + public page) before showing it. On approval: copy the three mockups + prototype onto arc/briefs-organiser-r1 in ONE batched commit, write the organiser DESIGN.md world (read untracked C:\dev\Website\DESIGN.md first), reserve the AD1 migration version, write briefs AD1 + ER-S1 (they must carry the gap list and the owner drops: price list, event Instagram), dispatch."
- (Owner 2026-10-21, after v2) ROOM = hidden until needed: no Room box by default; "+ Add a room" on the session opens it; once any session in the same list (event, one date, or festival day) has a room, every session in that list shows the box. Published as D1 v3, same link.

(Owner 2026-10-21, after v3: "make sure the user can edit events very easily, all edit buttons available") D1 v4, same link:
- Every editable event page has an "Edit" bar under the title (Sessions / Dates / Flyer / Details / About; festival: Party hours / Artists / Timetable / Flyer / Details / About) that jumps to that part.
- The title has a pencil and opens the rename sheet.
- Gaps closed: a draft's date could not be changed (now "Change the date" in Details; course drafts also change weeks); a festival's first day could not be moved (now in Details; counts as a change for "Update live event").
- Ended events stay read-only (rule: restore ended = admin only) and now say "Ended events can't be changed".
- Prototype bug fixed: "Discard changes" kept the first edit.
- Not added (outside the rules, owner can ask): changing the weekday of a live weekly event (move dates or Stop repeating + a new event cover it today).

## D1 APPROVED (owner 2026-10-21, after v4) -> published as v5, same link https://claude.ai/artifact/6zQZeapwq45Vs9kwnbdzcC
Stress test before v5 (local, Playwright): 61 states x phone + computer render with no errors; 17,910 random taps/inputs over 600 runs (3 seeds) with invariant checks (no undefined/NaN text, session end after start, dates sorted and unique, pending only on live/paused, no live event without a session, no route to a missing event) = 0 errors, 0 breaks.
Fixed by it: buttons behind an open sheet stayed tappable and leaving the event kept the sheet open (crash cascade); reason-line links 32px -> 44px; photo remove 32 -> 40px; title pencil 31 -> 44px; "Add a photo" tile had no label.
Builders must carry (prototype does not do these): focus moves into a sheet and Escape closes it; real dates/BST (festival starts_at is a true instant); real upload, postcode lookup and server refusals; the paused-event "Save changes" path.
Critique items for the briefs (owner may overrule): (1) two save models on one page (series = Update live event; one date = Save this date at once) - keep, the date sheet's button says it; (2) accent is used for links, pencil, Edit label and primary: builders keep the Edit bar label quiet if it competes; (3) no weekday change for a live weekly event (not in the rules).
NEXT: unchanged from the last HANDOVER's NEXT-SESSION PROMPT, starting at "On approval" (copy mockups + prototype to arc/briefs-organiser-r1, DESIGN.md organiser world, reserve AD1 version, briefs AD1 + ER-S1, dispatch).
(Owner 2026-10-21, click answers on the critique) SAVING = keep two models (one date saves at once; series waits for Update live event). WEEKDAY change on a live weekly = not now. ORANGE = keep exactly as the prototype (builders do NOT tone down the Edit bar; this overrides critique item 2 above). EDIT BAR = phone only (removed on computer; published as D1 v6, same link).

## CO-ORGANISING (owner 2026-10-21, click answers) -> D1 v7, same link, IN THE MAIN RELEASE
Today (origin/main SeriesOrganisers + organisersModel.ts): series.set_organisers refuses an added page the caller does not own or manage (ADD_ONLY_YOURS); owner-only edits; last organiser cannot be removed. D1 v1-v6 wrongly let anyone search ANY page.
Owner rules:
- INVITE, they accept: search any organiser page -> "Invite an organiser" -> chip "Invited" (cancel with x). Invited page sees it on Home under "Invitations" (Accept / Decline). It shows on their page only after Accept.
- RIGHTS = FULL EDITING for co-organisers (sessions, dates, cancel dates, details, about, flyer, pay, pause/resume, Update live event).
- Only the OWNER's team can End, Stop repeating, Delete draft, cancel a one-off event. Organisers block says "Every organiser can edit. Only the owner can end the event."
- REMOVING: owner removes any co-organiser; a co-organiser can only "Leave this event" (confirm sheet); nobody removes the owner.
- INVITING: ANY organiser on the event can invite.
- SAME TIME: the later Update is refused ("Someone else changed this event" -> Reload); never last-write-wins. (Website already has EventConflict on series.version.)
- Organiser changes (invite, cancel invite, remove, leave) save at once, not via Update live event.
- Public page: "By <owner>, <co-organisers>" (accepted only).
Server work for AD1 (new): invites table (series_id, invited page, invited_by, status pending/accepted/declined/cancelled, timestamps), owner-or-co-organiser invite RPC (rate-limited), accept/decline RPC by the invited page's team, leave RPC, owner-only remove; the edit-permission check must treat accepted co-organiser pages' teams as editors EXCEPT for end/stop/delete/remove/cancel-one-off (owner only). Check the existing SeriesOrganisers storage + series.set_organisers first and extend it; tests: co-organiser edit allowed, co-organiser end refused, non-member refused, invite to own already-linked page refused, accept by wrong team refused, version conflict refused.
Prototype verified: all jumps x phone+computer, click-through (accept, co rights, invite, leave, owner remove/cancel invite, conflict reload, public line), 23,700 random actions with co-organiser invariants (no owner-only control on a co event, no duplicate organiser/invite) = 0 errors.

## COLLISION RULES from the People arc (session bachata-admin-11april-62, 2026-10-21) - BINDING for briefs AD1 / ER-*
Their open work: admin PR #902 (migrations 20261129530000-20261129660000), Website PR #897 (claude/people-release-b-web, merges AFTER #902). Plan: ~/.claude/plans/plan-the-people-roles-wobbly-ember.md.
1. ER workers touching src/modules/organiser/flows/new/** (NewFlow.tsx, model.ts: serverCheckOf/finishReason read series_go_live_check_v1 via shared/goLiveCheck.ts) or src/modules/organiser/events/__tests__/goLiveSession* start ONLY from main AFTER #897 merges (or based on claude/people-release-b-web). Never in parallel. The New event flow must keep reading the server go-live check.
2. AD1 reserves AFTER 20261129660000 (next-migration-version.mjs handles it).
3. #902 changes the organiser FACT: organiser = owner/manager seat (entity_members) or active public team row; person_roles 'organising' is gone as a tick box. Guard check_person_organiser_derived_v1 REDS any function reading person_roles.role = 'organising'. AD1 must not read it.
4. If AD1 replaces any of these, port onto the #902 BODIES (never main's old body): _organiser_create_allowed_v1, _person_is_organiser_v1, get_public_person_organisers_v1, save_my_organiser_profile_v1, admin_save/get/search_person_v1, _dancer_whatsapp_eligible_v1, _my_dancer_edit_shape_v1, _stub_retire_blocker_v1, admin_dashboard_people_health_v1.
5. #897 does NOT touch SeriesOrganisers.tsx, organisersModel.ts, series.set_organisers, team strip or line-up chips -> co-organiser work is free there.
6. The People session says it will message when #902 and #897 merge; before dispatching ER flows/new work, check with gh pr view 902 / 897 (state MERGED).
UPDATE (same day): the People session says the owner put the organiser rebuild FIRST and let this arc decide what Release B removes. Answer sent: KEEP #897 (1) sign-up roles + landing, (2) /account/areas, (3) Teacher/DJ areas, and KEEP #902. REMOVE #897 (4), the NewFlow.tsx/model.ts change to the New event last step: the rebuild owns flows/new entirely. The rebuild's review step + event-page Publish READ series_go_live_check_v1 as the one publish rule, and AD1 EXTENDS that check to rules 3/10 (session on every first date, future first date, valid times, a way to pay, a flyer). Keep shared/goLiveCheck.ts if #897 adds it and others use it. Collision rule 1 above (wait for #897) is LIFTED once the People session confirms (4) is removed; rules 2-4 stand.
VERIFIED 2026-10-21: origin/claude/people-release-b-web head dffb7f9d changes ZERO files under src/modules/organiser/flows, src/modules/organiser/events, or shared/goLiveCheck.ts (git diff origin/main...branch). Collision rule 1 is LIFTED: the rebuild owns flows/new. Rules 2-4 (AD1 after 20261129660000, #902 bodies, no person_roles 'organising') still bind. People arc logs this as D104 and will message on #902/#897 merge.

## SHARED EMBER WORLD with Release B (People arc D105, 2026-10-21) - BINDING
- Owner chose the Ember/Outfit design for every Release B screen too. DESIGN.md organiser section scope = src/modules/organiser/** + src/modules/areas/** + the "What do you do?" step in src/pages/Auth.tsx.
- NEW SLICE ER-UI (first wave, alongside AD1 + ER-S1; disjoint dirs): branch claude/er-ui-ember, own bot PR. Adds src/modules/organiser/ui/ember.css: CSS variables with DEFAULTS = today's values, overridden under ONE class .ember-world with the prototype's :root (Ember #f0703a, ink #1d0a03, Outfit, graphite ground, Monzo radii/sizes). Components in src/modules/organiser/ui/* read those variables; props/exports unchanged (additive only). Old screens keep their look until the switch (rule 16); new screens + areas render inside .ember-world.
- ER-UI must run the areas tests (src/modules/areas/**) as well as organiser tests. Release B imports '@/modules/organiser/ui' and adds className="ember-world" on AreaFrame + the Auth roles step (their files). Release B does NOT build a tokens file.
- On ER-UI PR open: message the Release B session (release-b-mockups-rebuild) the PR number.
- (People D108, brief/people-d89 515ea02d) agreed. ER-UI ALSO OWNS: Chip remove button gets a 44px hit area (today 28px) inside ui/Chip.tsx without changing its look; Release B dropped it from its brief. Release B mockups (for reference): https://claude.ai/artifact/WLKq9QVDnb6HHBC1N3Z8fp
- (People D111) Ember scope widened: DESIGN.md organiser section scope ALSO lists src/pages/Account.tsx, src/components/account/DancerHome.tsx, src/components/account/profiles/ContinueAsPage.tsx, src/pages/AccountSettings.tsx (+ sub-views). Same .ember-world mechanics; People arc owns those files.
- (People D113) The People arc retires src/components/profile/ProfileEntryRouter.tsx + ALL role dashboards INCLUDING OrganiserDashboard.tsx (not on the rebuild's list; only src/pages/Profile.tsx uses them), on condition the organiser role there routes to /account/o (route test). The rebuild does not touch those files.

## DISPATCH METHOD (owner 2026-10-21, binding, replaces "briefs + dispatch" for everything that fits a lane)
On the owner's approval of this plan:
1. Split the work into slices, each in ONE lane: docs, tests, hook-tooling, website-screen, admin-ui. Anything needing a database migration stays OUT of the cards.
2. Per slice: node C:\dev\relay-checkout\ops\cards\cards.mjs new --title "..." --lane <lane> --repo <Website|Admin> --touches a,b [--from-file card.md], fill the five sections (Goal, Decisions already made, Boundaries, Checks on real data, Output: 20+ real chars each, branch set, touches set), then cards.mjs approve <id>. A queued card ("queued behind" / "cap", maxInFlight 3) waits.
3. Dispatch ONE worker per card (via dispatch-worker.mjs, branch = the card's branch). Each worker prompt says: record questions with cards.mjs park <id> --q --default --cost --where and CARRY ON with the default, never stop. The park keyword guard refuses prod/production/migration/delete/drop/truncate/payment/refund/price/rpc: for those the worker stops, pushes what is safe and says so in the PR.
4. DO NOT MERGE ANYTHING (overrides the Website self-merge permission for this arc). Bot PRs only.
Draft slice list (next session refines; the Card "touches" must not overlap or the tool queues them):
- C1 docs (Website): prototype + mockups onto docs/organiser-rebuild/, organiser DESIGN.md world with the full scope line (organiser, areas, Auth roles step, Account/DancerHome/ContinueAsPage/AccountSettings). Read the untracked C:\dev\Website\DESIGN.md first.
- C2 website-screen: ER-UI src/modules/organiser/ui/** (ember.css under .ember-world, defaults = today; Chip 44px hit area; areas tests too). Message release-b-mockups-rebuild the PR number.
- C3 website-screen: ER-S1 rules + lookup (event-rules.json, shared/eventRules.ts, useOrganiserSeries) + ER-S0 switch in shell/OrganiserRoutes.tsx.
- C4.. website-screen after C3: flows/new/** (New event), events/** (event page, sessions, details, about, organisers + co-organiser UI), dates/** (one date, bulk), home + desktop panes, public content (event page + calendar CONTENT only, exclusion-list files).
- admin-ui: only if admin screens must read the shared rules / cancel list (check rule 2 against admin first).
OUT OF CARDS (needs migration, owner decides how it is built): AD1 = owner payment_methods save, owner-callable draft venue create (rule 29), festival artist storage (rule 15), co-organiser invites + permissions (CO-ORGANISING section), series_go_live_check_v1 extended to rules 3/10. Reserve after 20261129660000; port onto #902 bodies. Website cards that call these RPCs build the screen + client against the pinned interface and say "server not landed" in the PR; end-to-end verification waits for AD1.

## OWNER APPROVAL 2026-10-21 (click): PLAN APPROVED = prototype v7 + co-organising + Release B decisions + card dispatch method.
AD1 = ONE separate admin worker started the usual way (dispatch-worker.mjs), OUTSIDE the cards, migration on its own branch; reserve the version first (after 20261129660000); nothing merged; owner applies at the end.
Everything else: cards per the DISPATCH METHOD section; one worker per card; workers park questions and carry on; NOTHING IS MERGED.
