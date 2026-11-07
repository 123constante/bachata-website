# Critique of mockup C3 (independent review, Design Gate stage 5)

Reviewed: `origin/claude/er-p3-mock-c3:docs/organiser-rebuild/p3/mockups/C3.html` (2,199 lines, read in full) + `C3.md`, against `M-C3.md`, `M-C2.md`, `DESIGN-COMMON.md`, `FIELD-INVENTORY.md` 5b / section 4, C2 (`origin/claude/er-p3-mock-c2`), `origin/main:src/pages/FestivalDetail.tsx`, `ember.css`. Line numbers below are C3.html unless marked. Reviewer did not build C3.

## 1. Verdict
Not ready for the owner's tour as it stands. It is ready after ONE fix pass: the look, tokens, contrast and tap sizes are clean, and every MUST below is small and local.
Top 3 must-fix items:
1. Session rows run the title and detail line together, and the role in brackets is lower-cased (K1 + K2). This is on every tour step.
2. Things that would put wrong information on the public page:
   - a date's "Starts at" that no session follows (#2);
   - "This and later" bringing back a session that was set to not run (#3);
   - bulk line-up saving only one of the picked dates (#4).
3. The festival preview does not match the real festival page, and the event preview leaves out the rows that the screens say dancers see (#5, #6).

## 2. Ordered fix list (most material first)

| # | M/L | Screen + line | What is wrong | Exact fix | Why it matters to a low-tech phone organiser |
|---|---|---|---|---|---|
| 1 | MUST | K1. Session rows `sessRow`, 888-896; CSS 250-251 (event page, date sheet, create step, festival) | `.ses .t` and `.ses .s` are inline spans, so the row reads as one run-on line: "ClassAll levels · Marco & Sofia (teaches)", "PartyDJ Kizzy (djs)", "CLASSNo name yetNobody on yet". Measured in all 6 width x theme runs. | CSS: `.ses .t, .ses .s { display: block; }` and `.ses .s { margin-top: 2px; }`. | This is the heart of C3 (the sessions timeline), and it looks broken on every tour step. |
| 2 | MUST | K2. `pplText`, 658 | The role is lower-cased in brackets: "(djs)", "(teaches)". | Drop `.toLowerCase()` and the brackets: `p[0] + ' · ' + roleLbl(p[1])` gives "DJ Kizzy · DJs" and "Marco & Sofia · Teach". Better: a role noun map `{teach:'teacher', dj:'DJ', perform:'performer'}`, giving "Marco & Sofia, teachers". | "(djs)" reads like a typo. Plain nouns read as finished. |
| 3 | MUST | K3. Event page "Where", 951 | It repeats the place name: "Colab Tower / Colab Tower, 8 Pipers Close, SE1 7PF". | Strip a leading `place + ', '` from `v.addr`, or store the addr without the name; in VENUES make it `'8 Pipers Close, SE1 7PF'`. | It looks like a data bug, which feeds the owner's "wrong info" fear. |
| 4 | MUST | A date has no time of its own (FIELD-INVENTORY trap 2). Move screen "Starts at" 1088 / 1092, Add a date "Starts at" 1739, handlers 1810 / 1811 / 1860; readers: Home hero 744, preview header 1181 | Move and Add-a-date write `x.time`, but the sessions, timeline and span ignore it. Home hero and preview read `x.time \|\| e.time`. Results: after a move, "Tonight, 9pm" sits beside "8pm to 1am". Fri 30 Oct, with an extra 7pm masterclass, previews as "8PM". Fri 6 Nov, with the class not running, previews as "8PM" though it starts at 9pm. | (a) Move it = date only. Remove its time input and add the line "To change the time, use Move every session". (b) Add a date = date only; sessions come from the event. (c) Home hero and preview header use `span(dsess(e, x)).s`. (d) "This and later" move must not write `e.time` (1811). | Dancers would turn up at the wrong time. This is the owner's biggest fear. |
| 5 | MUST | Session "This and later", `setSessOn`, 1294 | `delete o.cx` silently brings back a session that was "Not running" on a later date. Example: change the class time from Fri 30 Oct onwards, and the class cancelled on Fri 6 Nov runs again. It also overwrites later dates' own changes without saying so. The consequence line ("Earlier dates keep the old time") does not match what the save did. | Keep `cx` (do not delete it). In the scope sheet, add the line "Fri 6 Nov stays not running. Fri 13 Nov had its own party time: it changes too." (list affected dates from `x.so[sid]`). | Silent resurrection of a cancelled class means wrong public info, and the consequence line is not honest. |
| 6 | MUST | All dates > Pick dates > More > "Change the line-up on these dates", 2068 | `startLineup(..., p0[0], 'one')` saves to the first picked date only, while the header and toast say "3 picked dates". | Pass the picked list: `lu.dates = p0`. In `saveLineup`, loop `setSessOn(e, i, id, patch, 'one')` for each i. | The organiser believes 3 dates changed; 2 still show the old DJ. |
| 7 | MUST | Festival preview `R.fpreview`, 1645-1652 vs FestivalDetail.tsx | (a) Starred DJs show as Headliners; the real page takes headliners from teachers only (tsx 2533-2539). (b) 0 stars gives "0 Acts" and an empty grid; the real page shows all teachers, or hides the section (2539, 3053). (c) "Get Tickets" always shows; the real page shows a disabled "Tickets TBA" with no link (3001-3003). (d) The act label is hard-coded "Bachata Sensual"; the real label is the teacher's style, else the first music style, else "Lineup" (3063-3065). (e) The date line is "FRI 5 FEB 2027 – SUN 7 FEB 2027 · BPM…"; the real line is the `formatKeyRange` long form "Fri 5 – Sun 7 February 2027", with no venue. (f) The title split halves the words; the real page uses `splitTitleIntoLines` (1335-1349). | Port the 4 rules in (a)-(d) and the title and date helpers. Allow stars on teachers only, or show "DJs appear in the programme". Add to the preview bar a line "Close to what dancers see: gallery, venue, passes not shown". | The owner asked for the preview to match the current page (F15). An organiser who stars a DJ would be misled. |
| 8 | MUST | Event preview `R.preview`, 1176-1189 | The Prices screen says "Shown next to the ticket link" (1592), but the preview has no prices. About and Music are not shown either. The rule "preview shows ONLY what the rows hold" is broken by omission. | Add "Prices" (or "Free"), "About" and "Music" blocks, each with the `own()` "Not set yet" box when empty. | Copy points at something dancers will not see. Organisers can't check what they typed. |
| 9 | MUST | Remove from every date, 2021 + strip 942 | The toast says "Removed from every date. Dancers see it now", then the strip says "Removed, not saved yet". These contradict each other. | The save model is instant, so the strip reads "Removed from every date · Undo". | Two opposite messages for one tap. |
| 10 | MUST | Skip vs cancel wording: create hints 1218, 1222; skip handler 2032 | The create hints say "Skipping a week later? Cancel just that date" and "Skipping a week? Cancel that date afterwards". That contradicts the new "Skip this week (break)", which is a different thing (trap 4). The course skip sheet promises "the course gets one week longer" (1402), but `doskip` adds no date. | Hints become "Need a week off later? Open that date and choose Skip this week (break)". `doskip` on a course appends one date after the last class, and the toast says "Course now ends Wed 16 Dec". | Two words for one thing teaches the wrong habit. A promise the save does not keep. |
| 11 | MUST | The line-up, move and cancel scope sheets: `lineupscope` 1718-1723, `scope` 1704-1710, `cancelconfirm` | The consequence line exists only on the session scope sheet (1367). On the others it comes in the toast AFTER saving. The brief asks for scope to be clear BEFORE the save. | Add the `#sscons` note driven by `laterLine` / `oneLine` to these sheets, updated on radio change. | "This and later" is the riskiest choice in the product, so it must be read before the tap. |
| 12 | MUST | Date sheet `SH2.date`, 1375-1393 (too dense) | One sheet holds: span, change note, time hint + link, sessions card, "Add a session to this date only" + hint, Who's going, 5 choice cards, reset link, More options. At 390x844 it scrolls about 2.5 screens. "Move it" (another day or time) and "Move every session" (time) are two ways to change the time. | Smallest cut, nothing lost: keep sessions, "Change line-up" and "Cancel this date" (red). Move "Move it", "Different details this date", "Skip this week (break)" and "Copy changes" into one `More for this date` fold. Rename "Move every session" to "Change the time on this date". Rename "Move it" to "Move to another day". | The organiser opened the sheet to do one thing. Eight choices is where low-tech users give up. |
| 13 | MUST | Event page `R.event`, 899-972 (too dense) | Hero, Coming up, Repeats, Sessions, Line-up, a 12-row About card, a 4-button grid (Share / History / Make a copy / Status), and More options. Status (pause or end) is one quiet tile among four. C2 had a visible "Pause this event" button (C2:584). | Move Town, Run by, People who run it, and the views row into More options (all read-only or rare). Keep Share next to the preview bar. Put History and Make a copy in More options. Make Status a full-width row "Live · Pause or end it" under the hero. | It keeps every MUST row while showing the 6 that matter on first look. It restores C2's one-tap pause. |
| 14 | MUST | One word for one thing (`L` list, 411-436) | Several words or lists describe one thing (detailed in the next table). | Pick one word per thing, as the next table says. | Mixed words make low-tech users think these are different features. |
| 15 | MUST | Course class counts (#36): 922, 981, 1016 / 1019 | The long course shows three numbers for one fact: "8 classes" (legend), "10 classes" (Repeats row), and "Class 10 of 10" (All dates counts cancelled dates). | One `classCount(e)` that excludes cancelled and skipped dates, used in all three places. | Three numbers for one fact makes the organiser distrust the whole screen. |
| 16 | MUST | Help sheet, 1765 vs History, 569 / 1609 | Help says "Undo for 10 seconds… After that, change it back by hand". History offers Undo for up to a day ("Older than a day"). | Help: "Right after a change, tap Undo. For changes from today, open History on the event." | Two promises about the same safety net. |
| 17 | MUST | Home Needs you "Add the teachers…", 786 | It checks the flat C2 `c.lineup` (trap 6). Saving people on sessions never clears it, so it never ticks done, and it shows on Tour step 1. | `!cast(c).length`. | A to-do that cannot be cleared tells the organiser the app is broken. |
| 18 | MUST | Repeat screen, removal line 1546 / 1557 (#33) | `rem` compares live dates with the 8-date preview, so adding Saturday to Sensual Fridays shows red "This removes 8 dates", although adding a day removes nothing. | Compare live dates against the full new rule up to the last live date (not `rpDates()`'s 8). | A false red warning blocks a correct change. |
| 19 | MUST | Welcome / invitee, 709-725 + 532 | "We found your 12 events" counts the mockup stand-ins: a draft the organiser made, the stand-in festival, and the ended camp. | Keep `ORGS.llb.ids` at the original 9 for welcome and invitee. Push the stand-ins to a separate list used by Events, Home and Stats. | The first screen states a number that cannot be true on day one. |
| 20 | MUST | Desktop 1280: toast, `placeToast` 1785-1788 | On desktop the rail `#tabs` has top 0, so the toast is placed above the viewport (measured top -64) and never shows: Share, Undo, every save message. | Skip `#tabs` when it is the rail: `if (matchMedia('(min-width:1024px)').matches)` ignore it. | On desktop every Undo is invisible. |
| 21 | MUST | Desktop: bottombar, 346-347 | `.bottombar > * { max-width: 420px; margin-left: auto }` puts the button at x 820-1240, past the content edge (1160), over "Who's going". The full-width gradient ghosts left-column buttons ("Add the next session" on the festival page). | `.bottombar { left: 232px; right: 0; background: var(--bg); border-top: 1px solid var(--line) }`, and centre children to the content max-width: `margin: 0 auto; max-width: 1040px; display: flex; justify-content: flex-end`. | The primary button sits on top of content. |
| 22 | MUST | Date sheet "Different details this date", 1388 + `dayown` 1417-1421 (#58) | The subtitle promises "photo", but the sheet has none. The GAP puts this under More options (folded into #12). | Subtitle becomes "Place, about, ticket link". The photo goes with the phase-4 "Name, music, photos, price" entry. | Copy points at a control that is not there (definition-of-done rule). |
| 23 | MUST | More options "Rooms" row, 968 | It shows at 1-room venues ("This place has one room…"). The owner said rooms appear only at 2+ rooms. | Render the row only when `roomsOf(e).length > 1`. | The row contradicts the owner's answer, and it is a word the organiser does not need. |
| 24 | LATER | Festival programme, 2101-2102 (#70, #50, #D18) | Tapping a festival session only toasts; Add makes a fixed one-hour "New session"; the 20-hour warning cannot appear; "Add an artist" always adds Sofia Ramos. | Open `openSess` with no room and no people for festival sessions. Use the line-up search plus a Teacher / DJ pick for artists. | W3 is not in the 5-step tour, but an owner who taps it hits stubs. |
| 25 | LATER | New-session close toast, 1957 (#74) | "Removed 1 empty session (nothing was typed in it)" shows even when a name was typed. An empty-named new session can still be added (1346). | Drop it silently only when `!ss.d.t && !ssChanged()`. Otherwise ask "Add it, or throw it away?". | The toast is wrong. |
| 26 | LATER | Name and details tray, 2085 (#147, #136) | "N changes (tap to see)" opens the leave sheet with "Leave and lose them". "Undo my changes" has no confirm. Other edit screens (Where, Pay, Ticket, Prices, Repeat) have no tray and no guard (#134, #137). | Give the tray its own sheet ("Not saved yet": list + per-row undo + Close). Confirm "Undo my changes". Use the shared tray and guard on every edit screen. | It matters less while most edits save instantly. |
| 27 | LATER | Save-error states (#139, #149, #150, #152, #157, #158, #145) 1655-1663, ERRS 1493 | These appear only on the mockup-only screen. Real saves never say "Saved and checked. Dancers now see: …". ERRS lacks `contract_violation` and `has_bookings`. | Show "Saved and checked…" after the Name and details save. Add the 2 codes. | Phase 4 can carry it, but the GAP table overclaims. |
| 28 | LATER | Data / logic odds | Make a copy of a monthly event makes weekly dates (2095). Undoing Stop repeating restores `kind='weekly'` even for monthly (2051). History Undo only marks the row (2093). Repeat and course saves do not change dates (2080). The bulk "max 500" note always shows (1477): "Picking more than 500 dates at once? That's too many dates at once (max 500)". | Snapshot `kind`. Use `monthly()` for monthly copies. Show the 500 note only past 500. | Testers who go off-tour will see odd results. |
| 29 | LATER | Polish (measured) | Every sheet opens with a thick focus ring on its first control (1776); on the date sheet it runs into the hint above. "Show" wraps alone under the kind chips (1325). An `&nbsp;` hint leaves a gap (1328). The 58px `.tt` column pushes "+1" to its own line (247). The date strip's first chip is flush at x=0 (156). The "Change line-up" hero button wraps. | Focus `#sheettitle` (`tabindex=-1`) instead. Make kind chips a 2x2 grid. Render `#ssnd` only when needed. `.tt { width: 64px }` with "+1" inline. `.strip { scroll-padding-left: 16px }`. Shorten the hero button to "Line-up". | These are small, but the owner judges finish. |
| 30 | LATER | Desktop leftovers | In the left column the date strip spills into the gap (x 784 vs 766). The chart stays 340px wide in an 800px card. The rail shows on the welcome takeover with Home lit. Centred sheets keep the grab bar. `.tour` CSS is dead (242, 355). | `.ev2 > div { min-width: 0; overflow: hidden }`. Chart `preserveAspectRatio="none"` with width 100%. Hide the rail on `data-tabs="0"` takeover screens. Hide `.grab` at 1024px and up. | Desktop is secondary but shown. |

**Item 14 detail: one word per thing.** Each row lists the words used now, where they appear, and the word to use everywhere.

| Thing | Words used now (lines) | Use everywhere |
|---|---|---|
| The people on a session | "Line-up" (946), "Who's on?" (1051, 1332), "Change who's on" (1333), "Change line-up" | "Line-up" |
| The town | "Town" (952, 1637), "city" ("Ask us to change the city") | "town": "Ask us to change the town" |
| The party | "Party (social)" (chip), "Party" (kind tag), "Social" (`kindWord`) | "Party". The event-kind words stay "Weekly social" |
| A finished event | "Finished" (Events heading 802), "Ended" (chip), "This has finished (end it)" | "Finished" |
| An event on hand-picked dates | "Dates I pick myself" (1735), "Dates you add yourself" (929), "New event, dates I pick" | "Dates I pick" |
| Its kind label | `L.kind.custom = 'Social'`, so BOS reads "Social · Social with classes" (903) | "Dates I pick" |
| Levels | 3 levels on the course create step (`L.levels`, 1261); 5 on the session sheet (`L.lvls`) | One list |
| Course length | "How many weeks" 4 / 6 / 8 / 10 (1257) vs the "How many classes" stepper (1540) (#29) | "How many classes" stepper |
| The last date it ran | "Last night" (1454); in English this means yesterday | "Last date it ran" |

## 3. Lost from C2
- Event page "Pause this event" button (C2:584): now only inside the Status sheet (963 / 1439), one tap deeper. Restore it per #13.
- Public preview "Line-up" section (C2:734): gone. Names are only inline in Programme (1184), and a date with no people shows nothing. Restore a Line-up block under the Programme.
- Home Next-up was one line "place · line-up" (C2:464). It is now two lines (747-748). This is fine, a deliberate change for sessions.
- Line-up empty copy "Nobody yet. Search below to add a teacher or DJ." (C2:627) became "Nobody yet." (1064), which says less about what the person can do. Restore it.
- Tokens and shared CSS are identical. Additions only: `--chart`, `--chart-soft`, `.thm`; removed: `.themebtn`. Bars hide while typing, the invite journey, the welcome takeover, WhatsApp help, "Saves are coming soon", and Home after cancel or pause are all kept.

## 4. GAP LIST check (C3.md claims covered; the html does not, or does it wrongly)
All 127 GAP numbers appear in C3.md's table. These are overclaimed:
- **#29** Course create says "How many weeks" with 4 fixed buttons, not "How many classes" with any number (1256-1257).
- **#33** The red removal count is wrong (fix item 18).
- **#36** Class numbering counts cancelled dates (fix item 15).
- **#50 / #70 / #D18** Festival sessions and artists are stubs (fix item 24).
- **#58** It sits in the simple list, not More options, and promises a photo that is not there (fix item 22).
- **#59 / #106** Toast-only stub (2041). Acceptable as phase 4, but say "not drawn" in C3.md.
- **#63** Missing from fields: the "Different on N dates" badge appears only under sessions, not under Where / About / Ticket (Mambo's Where on Sat 2 Jan, 539 / 951).
- **#71** No grouping by kind. `.grp` CSS (258) is unused. C3.md argues the kind chip replaces grouping: record it as a deviation for the owner, not as "done".
- **#74** Wrong message (fix item 25).
- **#79** Contradiction between "not saved yet" and "Dancers see it now" (fix item 9).
- **#81** The room chips are in the main session sheet, not More options (1330).
- **#94** The line-up scope has no consequence line before saving (fix item 11).
- **#134, #136, #137, #147** Only on Name and details (fix item 26).
- **#139, #149, #150, #152, #157, #158** Only on the mockup-only screen, as static banners (fix item 27).
- **#145** 10 codes, not the 12 claimed (fix item 27).
- **#148** Marked "not drawn". It should be listed as open, not inside the coverage table.

Section 4 traps drawn wrong:
- **Trap 2** (date has no time of its own): fix item 4.
- **Trap 6** (flat line-up still read): fix item 17.

## 5. Measured table
Playwright Chromium, file://, Google Fonts stubbed (fallback fonts, so wraps may differ slightly). 285 reached states (280 from a breadth-first walk tapping every visible control, plus the 5 Tour steps), each replayed fresh at 3 widths x 2 themes = 1,710 measurements.

| Screen / states | Width | Theme | Contrast fails | Taps < 44 | Overflow / clip | Text run-together | Console errors |
|---|---|---|---|---|---|---|---|
| All 285 states | 390x844 | light | 0 (1) | 0 | 0 | `.ses` rows on every screen with sessions | 0 |
| All 285 states | 390x844 | dark | 0 (1) | 0 | 0 | same | 0 |
| All 285 states | 360x640 | light | 0 (1) | 0 | 0 | same, plus meta wraps early ("PartyDJ Kizzy / (djs)") | 0 |
| All 285 states | 360x640 | dark | 0 (1) | 0 | 0 | same | 0 |
| All 285 states | 1280x800 | light | 0 (1) | 0 | 0 (strip spills into the column gap, item 30) | same | 0 (but the toast is off-screen, item 20) |
| All 285 states | 1280x800 | dark | 0 (1) | 0 | 0 | same | 0 |

- **(1)** The only flagged text is the festival preview's outlined title (`.out`, transparent fill + #fb923c stroke on black, 319), which is intended and matches the live page. Skipped as text-on-photo: `.act.ph1`-`ph4` artist names, and "No photo yet" on the photo screen.
- **Toast:** checked separately. Light #ffb38a on #1d0a03 is 11:1; dark #a8461a on #f1f2f4 is 5.27:1.
- **Screen-reader-only run-together:** in the `dayown` field labels, innerText reads "WhereSame as usual" (1417).
- **Content under a bar at scroll end:** 0.

## 6. Verified / Not verified
**Verified:**
- I read C3.html in full and traced the logic of every MUST item in the code, with line numbers.
- Contrast, tap sizes, overflow, run-together text, under-bar and console errors were measured across 285 states x 6 runs.
- Screenshots at 390x844 (light and dark) and at 1280x800 were looked at.
- A separate pass (helper agent) compared the html against C2.html, FIELD-INVENTORY 5b + section 4, and FestivalDetail.tsx.

**Not verified:**
- The automatic walk did not open these sheets: those inside closed `<details>` (chat, socials, convert, copyfrom, videoerr), and those that need picking or typing (sessscope, bulkmore, bulkcancel, leave, galsel, fsess, create past "Where").
  - Items 5, 6, 11 and 18 are proved from the code, not from a click-through.
  - Contrast and taps on those sheets were not measured.
- Real fonts (Outfit / Bebas Neue were stubbed).
- Real phone, iOS keyboard, screen reader.
- No prod data was read: this is a read-only design review of a mockup. C3.md says its programme rows come from prod.
