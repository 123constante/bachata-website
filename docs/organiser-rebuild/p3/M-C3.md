# P3 mockup C3: C2's look + full admin-editor parity (the professional organiser dashboard)

Lane: normal (mockup only: no source edits, no DB, no PR). Branch `claude/er-p3-mock-c3` from `origin/main`.

## Why (owner's words, 2026-10-23)
"The mock-up looks very good, but you have missed out many features that the event editor does have. We need a professional
dashboard. The mock-ups look amazing." and "You didn't take into account that each event has sessions."
C2 was designed without the admin editor as an input. It draws a flat line-up per date; real events have a PROGRAMME of
sessions (prod: 1,823 party dates run 2-5 sessions, 189 run 6+; class dates 1-4; teachers sit on sessions). The check that
would have caught it is now `FIELD-INVENTORY.md` (beside this brief). C2 covers 15 of its 142 MUST rows. C3 closes the rest.

## Read first, in order (all on this brief branch unless noted)
1. `docs/organiser-rebuild/p3/DESIGN-COMMON.md`, `M-C2.md`, then `git fetch origin claude/er-p3-mock-c2 claude/er-p3-critique-c`.
2. `origin/claude/er-p3-mock-c2:docs/organiser-rebuild/p3/mockups/C2.html` + `C2.md`: your starting file. Copy to `C3.html`.
3. `docs/organiser-rebuild/p3/FIELD-INVENTORY.md` (170 KB; read sections 1, 3, 4, 4b, 5, 5b GAP LIST, 5c Wording, 6 in full;
   use section 2's matrix as lookup). The GAP LIST (127 lines, each = screen + control + words + simple/More options) is your
   work list. Section 4 "Traps a designer must not draw wrong" is binding.
4. The current Website festival page (`src/` festival route + components; find it with `graphify query "festival detail page"`
   or grep) for W3: the organiser's festival preview must look like the CURRENT dancer festival page (owner F15).

## Binding: keep C2 exactly, add, do not redesign
Same tokens, type, spacing, Home (Next up hero + quick actions, Needs you, stats, events), tabs Home / Events / Stats / You,
date strip with "this date only / this and later ones", sheets for confirms, all C2 wording decisions (M-C2.md "Decisions
already made"). Progressive disclosure: one thing at a time; simple first, advanced behind "More options" exactly as the GAP
LIST says. Low-tech phone organisers (owner profile): plain words, one primary action per screen.

## Owner answers that C3 must show (20 + 15, 2026-10-23, binding)
- Sessions = a TIMELINE list per date (time, kind, title, room if 2+ rooms, people with roles). Tap a session -> its sheet
  (time, type, room, people, level for class/workshop only, "ends next day" when past midnight). Kinds that matter:
  class/workshop + social. Add / edit / remove / reorder sessions in create flows AND on the event page.
- Per-date session changes "this date only / this and later" at launch (W1): show both in the scope sheet for sessions,
  line-up, time, level, room. (The server has no forward path for programmes yet; draw it anyway, it is phase 4's job. Draw
  the honest consequence line, e.g. "Changes from Wed 4 Nov onwards. Earlier dates keep the old line-up.")
- Cancel a session on one date (struck through, "Bring it back") vs remove a one-date session vs delete from every date
  (inventory section 4 trap 3). Skip a date vs cancel a date: different words, different consequences.
- "Professional" = premium look + rich stats (W2): views-over-time chart, per-date numbers, "where views come from" (stand-in
  data, labelled stand-in), Who's going count. Use the dataviz rules: one accent, readable in both themes, a table fallback.
- Light/dark: an Auto / Light / Dark button reachable on EVERY screen (header icon -> 3-choice sheet).
- Desktop: phone-first, but at >= 1024 px a wider layout (e.g. left nav rail instead of bottom tabs, event page two columns:
  dates + sessions / details). Must still be one file; show it at 1280x800 as well.
- Bulk, simple (W2): "this and later" + "Pick dates" multi-select for Cancel these dates / change line-up on these dates.
- Edit history (W2): event page "History" list (who, what, when, in plain words) + "Undo" only where possible; where not,
  say why ("Photos can't be undone").
- Duplicate whole event (W1): "Make a copy" -> name + first date -> draft; list what is copied and what is not.
- You tab: organiser profile edit: name, logo, bio, Instagram, WhatsApp, website (+ the phone/email public toggles C2 has).
- Venues: organisers add a new venue (name, address/postcode, map pin); it is used straight away; a quiet "We check new
  venues within a day" line. Rooms appear only when the venue has 2+ rooms.
- People with no profile: name only + "Send them an invite link".
- Organisers NEVER see controls for: delete, merge, change the event's organiser, edit the city, featured/promoted.
  City shows read-only with "Ask us to change the city". Delete stays "Want it gone for good? Ask us".
- Waves, drawn in this order and labelled in C3.md: W1 socials / parties / courses + sessions; W2 stats / history / bulk;
  W3 festivals.
- Festivals (W3): weekend 2-3 days; programme = day tabs + timeline; ONE room (no room UI); TICKET LINK ONLY (no prices, no
  passes); artist list only (no per-session people); roles teachers (couples shown as a pair) + DJs; organiser stars up to
  6 headliners ("Star" toggle, counter "4 of 6"); one main venue; city read-only; Who's going = one count for the whole
  festival; NO "copy for next year" (each year is a new event); no extras; organisers create festivals and they go live at
  once. Preview = the current Website festival page style.
- Going slot (behind a flag, draw it as present): Home Next-up line "N going"; date sheet row "Who's going (N)" opening a
  people list; Stats by-event count. A peer arc builds the real components (`src/modules/going/`: GoingNightSummary
  variant="compact", GoingPeopleSheet); just leave clear slots with those names in HTML comments.

## Data and shapes
Real shapes from FIELD-INVENTORY section 3 (sessions per date incl. a 6+ session party night, a course, a monthly event, an
ended event, an event with no sessions, a long series crossing a year). Read London Loves Bachata's live events from prod via the
Supabase connector if your environment has it (SELECT only, public fields); otherwise reuse C2's data. People names stay
stand-ins (say so). Status is derived from dates (C2 showed a live Sep course as Ended: fix).

## Output (ONE push at the end, or one PARTIAL push at the context limit: every Website push costs a Vercel deploy)
1. `docs/organiser-rebuild/p3/mockups/C3.html` (self-contained like C2; Google Fonts only; a small "Tour" link that jumps to
   the 5 owner-tour screens: Home -> event page with sessions timeline -> tap a session + "this and later" -> Stats ->
   create a weekly social with two sessions).
2. `docs/organiser-rebuild/p3/mockups/C3.md` (max 90 lines): GAP LIST coverage table (every GAP LIST # -> done / how, or
   "not drawn: why"); new screens; shared labels list; the 5-step owner tour (one line per step, what to tap, what they see);
   self-checks MEASURED with Playwright at 390x844, 360x640 AND 1280x800, light AND dark, plus keyboard-open simulation
   (390x514): text contrast >= 4.5, taps >= 44 px, no sideways scroll, nothing under a bar, 0 console errors, theme button
   present on every screen (scripted count); re-run C2's 25 logic probes + new probes for sessions (add, cancel-one-date,
   this-and-later consequence line, remove vs delete wording); Verified / Not verified.
If you reach the context limit: push C3.html with the waves finished so far + C3.md "left to do" (GAP LIST numbers), commit
subject ending PARTIAL as the dispatch prompt says. A continuation worker carries on in the same files.
