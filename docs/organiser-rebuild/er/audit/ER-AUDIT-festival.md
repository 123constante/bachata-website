# ER-AUDIT: festival family (ER-C10)

Ticket `dt_d62750d2dc86`. Read-only audit per brief `ER-AUDIT.md` (sha 000dac1) plus the owner decisions in the dispatch (2026-10-22). No source edited; this file is the only change.

| Slice | Branch | Head audited | Base |
|---|---|---|---|
| ER-C10 festival | `claude/er-c10-festival` | `7db7322` | `claude/er-wave1` `4c6d1f5` (S1 + UI + C4 + C5 pre-fix), not contained in any other branch |

Files: `src/modules/organiser/events/festival/{festivalModel.ts 371, festivalApi.ts 45, FestivalCreate.tsx 57, FestivalEdit.tsx 109, FestivalNights.tsx 91, FestivalArtists.tsx 64, FestivalTimetable.tsx 72, index.ts, __tests__/festival.test.tsx 280}`. Line numbers below are at `7db7322`.

## Verdicts

**Write path (`festivalModel.ts` toTree / itemFromSession / commands) + `FestivalEdit`: REBUILD.** The write path loses or corrupts stored data in ordinary edits, proved by a throw-away probe test against the real code (not pushed): (1) "Add a day" writes the new day with `date_offset_days: 0`, so the new night lands on the FIRST day, not after the last (`buildDays` defaults `raw.date_offset_days ?? 0`, `toTree` builds new days with `raw: {}`, `festivalModel.ts:296`); (2) "Remove this day" on any day but the last re-creates every later session without its id, room, theme, style, track (`itemFromSession(s, storedItems.get(s.id))` looks the moved session up on the WRONG stored day, `:298,324`); (3) touching a day's timetable turns every untimed stored item into 12:00-13:00 (`sessionFromItem` `:99-102`), against the owner decision that untimed sessions are valid; (4) a room typed in the session sheet is never written (`itemFromSession` keeps only `raw`, `buildDays` writes `raw.room`); (5) every new line-up person is written `profile_type 'teacher', role 'teaching'`, including DJs on a party (`:285`). It also keeps its OWN session<->stored mapping instead of C4's `fromStored`/`toStored` (ER-AUDIT-editor-cards F-family), and `FestivalEdit` has no ended lock, no Organisers entry, no conflict handling and shows raw server text. These are not one-line patches: the day/offset model and the session mapping must be redesigned on top of C4's fixed mapping, so a fresh worker is cheaper than patching.

**Create entry (`FestivalCreate`): REBUILD.** Prototype v7 makes festival a FORMAT inside the one New event flow (`steps()` = name, format, venue, date, **nights**, flyer, **pay (ticket link, required)**, more, review; proto line 417-449). C10 built a standalone fragment (first day + days + optional ticket link + nights) with no name, venue, flyer or review, whose `onCreate(draft)` nobody turns into a server write (no create command builder in the slice; `startsAt`/`endsAt` exist but nothing sends them). It cannot be "switched on" by flipping a rule: there is nothing to mount it into (C7 `parseFormat` refuses `festival`, `flows/new/model.ts:35`). Rebuild as the C7 "nights" step + festival branch of the pay step.

**`FestivalNights` (party hours UI): KEEP with FIX.** Matches rule 26 (every night listed, tap to change, "Use these hours every night" on the open night, default 22:00-04:00, 48px selects, 52px rows). Fix: show "to 04:00 (next day)" like the prototype instead of `22:00&ndash;04:00` (`:50`), read-only when ended, reuse in the rebuilt create step.

**`FestivalArtists` + `festivalApi`: FIX.** RPC names and keys match ER-INTERFACE AS BUILT; `parseArtists` drops unknown roles; one list shown as the line-up. Missing: the ended lock (owner decision), Performer searches the `teaching` role (parked), stale hits kept when the term is cleared.

**`FestivalTimetable`: FIX** (moves with the write-path rebuild). Uses the C4 sheet and Copy a day as asked, but opening an EMPTY day inserts a 12:00 workshop into the draft before the sheet opens (`:24`); closing the sheet without saving leaves it there, the Save button turns on and a junk workshop is written. Copy a day is disabled with no reason (`:41`).

**Overall family: REBUILD** (model write path, create entry, edit shell). Salvage `FestivalNights`, `FestivalArtists`, `festivalApi.ts`, the instant helpers `nightInstant/startsAt/endsAt` and the BST test table.

## 1. Mounted?

NOT MOUNTED. No file outside `events/festival/` imports it on `origin/main`, `claude/er-wave1`, `claude/er-c7-new` or `claude/er-c8-eventpage` (`git grep FestivalCreate|FestivalEdit|events/festival`). The branch is contained in no other branch. `OrganiserRoutes.tsx` (main) has no festival route; C7 offers Weekly / One-off / Course(OFF) and its code comment says "a festival starts in its own flow (ER-C10), not here" while C10 says "C7 mounts Create": each slice points at the other, so festival create is reachable from nowhere. The festival Edit has no host either (C8 event page does not import it). The C10 handover says this honestly.

## 2. Rules owned (prototype v7 + PLAN rules 14, 15, 26; D1 gap "Festival")

| Rule | Verdict | Where |
|---|---|---|
| 14 formats incl. Festival (now ON per owner) | FAIL: not offered anywhere; C7 has its own hard-coded `NEW_FORMATS` and `parseFormat` instead of reading `ownerCreateFormats` (C7 family, but it blocks this slice) | C7 `flows/new/model.ts:29-37`; `event-rules.json:11` on wave1 still `["one_off","recurring"]` |
| 15 start date + number of days | PASS (model), FAIL (shape: prototype offers 2-5 days in the create flow; C10 1-14, parked) | `festivalModel.ts:25-27`, `FestivalCreate.tsx:34-45` |
| 15 ticket link only, no pass editor | PARTIAL: only a ticket field is shown, but it is OPTIONAL (prototype: "Add the ticket link" blocks the pay step, proto 425) and `payment_methods: 'ticket_link'` is never sent, so go-live answers `no_payment` | `FestivalCreate.tsx:46`, `basicsCommand :344-349` |
| 15 one party per day, public page lists each night | PASS on read (first party row per day); public page is C6 | `:88-91` |
| 15 workshop timetable optional, any time incl. after Go live | PARTIAL: present; empty-day open bug, untimed rewrite | `FestivalTimetable.tsx:24`, `festivalModel.ts:99` |
| 15 one artist list (search, Teacher/DJ/Performer) as the line-up | PASS (organiser screen only, per AS BUILT); ended lock NOT BUILT | `FestivalArtists.tsx` |
| 26 every night listed, tap to change, "Use these hours every night", default 22:00-04:00 | PASS | `FestivalNights.tsx:37-90`, `festivalModel.ts:151` |
| 26 end shown as a time with "(next day)" | FAIL (bare en dash range) | `FestivalNights.tsx:50` |
| D1 add/remove a day | FAIL on write (new day at offset 0; middle removal drops ids) | `festivalModel.ts:163-181,294-331` |
| Prototype event page: Party hours / Artists / Timetable blocks + Edit-bar jumps incl. **Organisers** (proto `SECS` line 535) | FAIL: six accordion entries, no Organisers | `FestivalEdit.tsx:18-25` |
| Prototype: ended festival not editable (`editable(e)=status!=='ended'`, proto 317, 484-491) | NOT BUILT: no lifecycle prop at all | `FestivalEditProps :30-39` |
| Moving the first day counts as a change for "Update live event" | PASS (label is "Update live event" whenever `live`; `needsUpdateLive` exported but unused) | `:54`, model `:369` |

## 3. Server as built

ER-AD2 handover (admin `claude/er-ad2-admin`) could NOT be read: this sandbox has no access to `bachata-admin-11april` (add_repo: "you don't have access"). Judged against ER-INTERFACE AS BUILT (AD1) plus the dispatch summary of AD2 (festival create accepted, artist storage, ended lock).

| Item | Verdict |
|---|---|
| `series_festival_artists_get_v1(p_series_id)` -> `[{person_id, role, name}]` | PASS (`festivalApi.ts:33-37`; also tolerates `{artists:[...]}`) |
| `series_festival_artists_set_v1(p_series_id, p_artists [{person_id, role}])` | PASS keys (`:27-30`) |
| Error texts mapped | FAIL: none. Raw `error.message` (e.g. `permission_denied: ...`, PGRST202 "function not found" while the server is not landed, the AD2 ended-lock refusal) is shown verbatim (`FestivalEdit.tsx:64`) |
| Ended lock (AD2) | FAIL: screen lets the person edit and only learns on save |
| Festival create (AD2) | NOT BUILT: no create payload; `startsAt` true instant never sent; C7 owns the create command and refuses `festival` |
| `payment_methods` (AS BUILT: festival accepts `ticket_link` only) | FAIL: never sent on create or edit |
| `EventConflict` / `series.version` | NOT HANDLED: `deps.send` is injected; a two-command save (upsert then set_program) that fails on the second leaves the first stored and a retry re-sends both |
| Go-live: festivals need a timed session every programme day (`no_session_first_date`) | NOT SURFACED: the screen never says a night needs a party time; it relies on the default party row being written |

## 4. Shapes

Supabase connector needs owner authorisation in this session: NO fresh survey. Shapes from the C10 handover survey (2026-10-21, counts only): 12 festivals, 7 live; live days/items/parties = 4/12/4, 4/4/4, 6/6/6, 4/4/0, 3/6/3, 5/14/10, 4/4/1; plus 223 untimed items site-wide (ER-FIX-C4 survey).

| Shape | Handled? |
|---|---|
| Day with no party row (4/4/0, 4/4/1) | Reads default 22:00-04:00 and shows it as if stored, with nothing to tell the organiser it is not saved; untouched save sends nothing (tested) |
| Two parties on a day (5/14/10) | First edited, rest echoed (tested) |
| Untimed workshop / party | Untouched: echoed. Touched day: rewritten to 12:00-13:00 (F2) |
| Party with start but no end | `stored=null`, shows the DEFAULT end as if real (F11) |
| Programme with zero days (draft) | One default night; fine |
| `date_offset_days` not equal to index (any festival with a gap day) | Ignored: night i is drawn as `startDate + i` (F12); not surveyed |
| Ended festival (prototype 'sb') | Fully editable (F4) |
| Festival with a co-organiser (6 two-organiser events) | No Organisers entry on the festival edit bar (F7) |
| Series with no organiser (571) | Not this slice's concern; no organiser gate here |
| > 100 rows | n/a (max 14 items) |

## 5. Tests

`npx vitest run src/modules/organiser/events/festival` on `7db7322`: **103 passed, 1 file** (exit 0). `npx eslint` on the dir: 0 errors, 4 fast-refresh warnings. `tsc --noEmit -p tsconfig.app.json`: 0 errors in `festival/`. No raw non-ASCII in the dir.

- 72 of 103 are the day-count x timetable x six BST dates table. They assert `startsAt()` (correct, and genuinely across both 2026 clock changes) and "untouched sends nothing" (real), but `startsAt` is sent by nothing, so the table tests a helper no write uses.
- Can fail: a mutation that disables timetable writes in `toTree` turns 2 red. Vacuous for the bugs found: no test checks `date_offset_days` of an added day (the add-a-day test only checks `id` and length), no test moves a session with a room/id across a removed day, no untimed input, no ended state, no empty-day open-then-cancel, no error text mapping, no co-organiser.
- The shape table is over day counts, not over lifecycle (live/ended/draft) or organiser count.

## 6. Design

From code only; no browser walk (nothing mounted, no screenshots).
- Tap targets: explicit px, 44/48/52 everywhere. PASS.
- Density: `p-[12px]`, 13-16px text. PASS; Create stacks `space-y-[16px]` (looser than the rest).
- Colours: `--mut`, `--danger`, `--gold`, `--line*` all exist in `ui/ember.css` on main. Selected role chip is border-only (`--gold` border) with no fill: weak selected state.
- Helper paragraphs (ER-COMMON "no helper paragraphs"): "Add a class or workshop so dancers see the timetable." under every empty day (`FestivalTimetable.tsx:45`), `LINEUP_EMPTY` sentence. Prototype has "Workshop timetable can be added later" once.
- Artist summary on the edit bar is a bare number ("3") (`FestivalEdit.tsx:72`).
- Day labels "Friday 24": full weekday PASS; no month, ambiguous across a month boundary.
- Not seen: clipping of long artist names next to the role select at 390px, sideways scroll, real contrast.

## 7. Dead code and duplication

- Own session<->stored mapping (`sessionFromItem`, `itemFromSession`, `festivalModel.ts:98-105,275-288`) duplicates C4 `fromStored/toStored` (on `claude/er-c4-sessions` after ER-FIX-C4). Branch carries the PRE-FIX `sessions/**` and `venue/**` (editor-cards audit, family-wide note).
- `needsUpdateLive`, `datesChanged` (only via it), `endsAt`, `startsAt`, `hasTimetable` (tests only), `createProblem` export: no production caller.
- Two people-search functions: `FestivalEdit` takes both `search` (timetable) and `deps.search` (artists).
- `FORMAT_WORDS` lives in C7; festival screens define their own wording.

## Findings

| id | sev | file:line | what | failing scenario | fix in words |
|---|---|---|---|---|---|
| F1 | blocker | festivalModel.ts:296 (+ programmeSeriesModel `buildDays`) | New day written with `date_offset_days: 0` | 3-day festival, "Add a day", Save: day 4 is stored on day 1's date | Set `day_index`/`date_offset_days` from the night index on every written day; test the payload offsets |
| F2 | major | festivalModel.ts:99-102 | Untimed stored items become 12:00-13:00 | Edit any session on a day that has an untimed party/workshop: all untimed rows on that day get 12:00 | Use C4 `fromStored/toStored` (fixed per editor-cards audit) which keep "no set time" |
| F3 | major | festivalModel.ts:298,324 | Removing a non-last day loses ids, room, theme, style, track of every moved session | 4-day festival with rooms, remove day 1: days 2-4 sessions are deleted and re-created bare | Key stored items by id across the whole tree, not per base day; or keep day rows with their content and only drop the removed day row |
| F4 | major | FestivalEdit.tsx:30-42, FestivalArtists.tsx | No ended lock | Ended festival: artists editable, save refused by AD2 with raw text | Take lifecycle; when ended, artists (owner: the list) read-only with "Locked after the festival ended" |
| F5 | major | FestivalCreate.tsx (whole), C7 model.ts:29-37 | Festival create unreachable and incomplete (no name/venue/flyer/review/write) | Owner switched festival create ON: there is no way to create one | Rebuild as the "nights" step of the C7 flow + festival pay step; C7 reads `ownerCreateFormats` |
| F6 | major | festivalModel.ts:344-349, FestivalCreate.tsx:46 | `payment_methods: 'ticket_link'` never sent; ticket link optional | Create a festival, Go live: `no_payment` blocker | Ticket link required on the pay step; send `payment_methods: 'ticket_link'` with `default_ticket_url` |
| F7 | major | FestivalEdit.tsx:18-25 | No Organisers entry | Co-organiser opens a festival: cannot see or manage organisers (owner: everyone has full control) | Use the shared event Edit bar (prototype `SECS`) with festival sections; Organisers present for every organiser |
| F8 | major | FestivalTimetable.tsx:24 | Opening an empty day inserts a workshop before the sheet | Tap "Add sessions", close the sheet: Save turns on and writes a 12:00 workshop | Seed the sheet's own state, write to the draft only on sheet Save |
| F9 | major | festivalModel.ts:275-288, programmeSeriesModel buildDays | Room edits dropped; new people always `teacher/teaching` | Add a DJ to a party or set Room 2 on a workshop: stored as teacher, room lost | C4 `toStored` (room, role per kind) |
| F10 | major | FestivalEdit.tsx:56-67 | Errors shown raw; no conflict path; partial save on two commands | Server not landed: "Could not find the function public.series_festival_artists_set_v1"; upsert ok + set_program fails then retry re-sends | Map error codes to short copy; reuse the shared `EventConflict` sheet; send one combined command or refresh `original` after each success |
| F11 | minor | festivalModel.ts:118-122 | Party with start but no end shows default hours as if stored | Stored party 21:00/null shows "22:00-04:00" | Show the stored start, end "Not set" |
| F12 | minor | festivalModel.ts:134 | Night date = start + index, ignores stored `date_offset_days` | A festival with a rest day draws later nights a day early | Read offsets from the day rows |
| F13 | minor | FestivalNights.tsx:50 | End not marked "(next day)" | 22:00-04:00 reads as a 6-hour backward range | Use the shared end label |
| F14 | minor | FestivalTimetable.tsx:41 | Copy a day disabled without a reason | Day with no sessions: button greyed, no why | "No sessions to copy" / "Only one day" |
| F15 | minor | FestivalArtists.tsx:12 | Performer searches teaching profiles | A performer-only person cannot be found | Server search role for performer (parked Q) |
| F16 | minor | FestivalTimetable.tsx:45, FestivalEdit.tsx:72 | Helper sentence on every empty day; bare artist count | Visual noise; "3" means nothing | One caption; "3 artists" |
| F17 | minor | festivalModel.ts:25-27 | 1-14 days vs prototype 2-5; remove any day vs "Remove the last day" | Diverges from approved prototype, unrecorded | Follow prototype or record the deviation |

## Full control (owner decision 2026-10-22)

The slice has NO owner-only copy, disabled state or hidden control: it takes no role at all. The gap is the opposite: it has no Organisers entry (F7), so on a festival nobody, owner or co-organiser, sees the organiser list from this screen, and it has no cancel / stop-repeating (not applicable to a festival) or "cancel the festival" control (a festival is a one-off-like event; prototype puts cancel on the shared event screen). Retries: the slice sends no invite or cancel, so the "already invited / no longer open = success" rule does not apply here.

## REBUILD would need (tell the fresh worker)

1. Build festival as a FORMAT of the one New event flow (C7): format step lists Festival from `ownerCreateFormats` (now `one_off, recurring, festival` in BOTH copies of `event-rules.json`, guarded by `check-event-rules-mirror.mjs`), then name, venue, date, **nights** (reuse `FestivalNights`, days picker), flyer, **pay = ticket link, required**, review. Send `payment_methods: 'ticket_link'`. Server festival create per ER-AD2 (read it; this audit could not).
2. The festival event page is the SHARED event screen (C8) with festival sections Party hours / Artists / Timetable and the shared Edit bar incl. Organisers, Flyer, Details, About; not a separate accordion.
3. Programme writes go through C4's fixed `fromStored`/`toStored` (after ER-FIX-C4 lands); never a second session mapping. Untimed stays untimed; block only a half-filled time or end before start.
4. Every written day carries the correct `day_index` and `date_offset_days`; add/remove day tests assert them; stored item ids survive a day removal.
5. Ended festival: artists read-only with a line saying it is locked after the festival ended (and the rest per prototype `editable`); map the AD2 refusal text anyway.
6. Map server errors (not landed, permission, ended, conflict) to short copy; one save = one round-trip or refresh the base after each success.
7. Tests: table over lifecycle (draft/live/ended) x day counts x timetable (timed/untimed/rooms) x BST; assert payload offsets, ids, rooms, roles; a test that opens an empty day and cancels sends nothing.
8. Start from a branch that already has C4/C5 fixed heads; touch `events/festival/**` plus the C7/C8 hook points the orchestrator assigns.

## Verified

- Read the whole slice at `7db7322`, the brief, ER-C10, ER-COMMON, ER-INTERFACE (AS BUILT), PLAN rules 14/15/26 and D1 gaps, prototype v7 festival code, the editor-cards audit.
- Ran the slice tests (103 pass), eslint (0 errors), tsc (0 festival errors).
- F1, F2, F3 proved by a throw-away probe test on the real model (added day `date_offset_days: 0`; untimed written `12:00/13:00`; moved session written without `id`, `room: null`, `theme: null`). Probe deleted, not pushed.
- Mutation: disabling timetable writes turns 2 of 103 red.
- Not mounted: grep across main, wave1, C7, C8.

## Not verified

- ER-AD2 handover (no access to the admin repo from this sandbox): festival create payload, artist storage details, exact ended-lock refusal text.
- Fresh prod shape survey (Supabase connector not authorised in this session); shapes are the C10/ER-FIX-C4 handover numbers. `date_offset_days` gaps not surveyed.
- Browser walk at 390x844, screenshots, contrast, clipping: nothing is mounted.
- Full `npm run lint` chain, `npm run test:unit`, `npm run build` on the festival branch (only the slice-scoped checks above).
- End-to-end with the server (artists RPCs, festival create).
