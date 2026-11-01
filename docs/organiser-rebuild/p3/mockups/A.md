# Mockup A &mdash; "Calm Ember" (open `A.html` in any browser; tap through)

**Idea.** Today's Ember, polished: dark graphite + ember orange, Outfit, big rounded cards, plus a matching light mode. Home is one calm list of "Your events" under one quiet stats tile. The event page is a stack of plain rows (Dates, Line-up, Photos, Where, How to pay, Co-organisers); each opens one focused screen with one Save. Typography and spacing do the work; no decoration.

**Screens (all reachable by tapping; Back works; Esc = back):** first-day "We found your 6 events" &rarr; Home (stats 7/30/90 days, 6 live, 5 finished) &rarr; Event page (Bachata Flow, weekly) &rarr; Dates (13 Mondays + "Show 13 more", far dates show the year, one already cancelled) &rarr; One date &rarr; Move it (only this / this and all later) or Cancel this date (Undo toast) &middot; Line-up &rarr; people picker (real profiles) &middot; Photos (cover, gallery, no-photo empty state) &middot; Where &middot; How to pay (tick all that apply) &middot; Co-organisers (all equal, waiting invite) &rarr; Invite by mobile (kind inline error shown) &middot; Pause (Undo) &middot; See what dancers see (public preview, flags the missing pay line) &middot; Add an event &rarr; Create a course (4 steps: name, weeks with live date summary, venue, check and go live) &middot; Ask us (help, delete requests) &middot; New organiser: one event, no photo, long name, empty stats.

**Data.** London Loves Bachata's real live events, venues and start times from prod (`event_series_p5`, SELECT only, 2026-10-23). Stats are illustrative (~893 views/30 days per brief; saves have no table yet, G49). Line-up names are stand-ins, not real profiles. "London Loves BOS" monthly cadence is a guess (its repeat rule is empty on prod).

**Gaps answered.** G12/G29/G30 every empty and error state says the next step (one shared EmptyState + InlineError look). G16 one word per thing ("How to pay"; "Buy online" not a 2nd "Ticket link"). G20 far dates carry the year. G21/G22/G34 every target &ge; 44px, one ActionRow. G28/G32 disabled button keeps a readable reason under it. G31 accent text uses `--gold-fg`, never `--gold`. G48 course create is ON. G49 stats tile + per-event line. G54 no claim step. G56 invite a person by mobile/email, not a page. G24 a written token set incl. light.
**Benchmark patterns.** #1 empty state = reason + one matching button; #2 this date / this and later (no "all" needed: that is Repeats); #4 stats as one line with 3 ranges; #5 Pause, not delete; #7 course block in one screen. Anti-patterns avoided: no ticketing words, undo instead of irreversible cancel, no visibility modes, no roles, delete is "Ask us" (admin-only).

**Trade-offs vs B (photo-led) and C (today-first).** + Lowest build risk: same structure as c8 EventPage, maps to the SALVAGE table; easiest to learn (one list, one page, rows). + Smallest new CSS. &minus; Less "Airbnb warm" than a photo-led home; covers are small thumbs. &minus; No "what's on tonight" focus; tonight is only a line ("Tonight, 8pm"). &minus; Six rows is a long page on a small phone; Pause sits below the fold.

**New primitives.** ActionRow (label, value, todo tone, chevron), QuietButton, ChoiceList (radio + checkbox, `aria-checked`), InlineError, StepFrame (progress bar + one question), EmptyState, UndoToast, StatsTile, DateRow, PersonRow, ComingSoonSlot (featured placeholder). Labels in one `labels.ts`.

**New tokens (light mode, same names as `.ember-world`):** `--bg #f7f4f1 --card #fff --card2 #f0ebe6 --line #e6dfd8 --line-strong #8a8178 --fg #1f1a17 --mut #635a53 --ph #6f665e --gold-fg #b2461a --danger #b3261e --ok-fg #1d6b47 --warn-fg #9c3d14`; plus `--pause-bg` (both modes). Dark values are ember.css unchanged.

**Self-checks (measured with Playwright/Chromium at 390x844, every screen, both themes, script in hand-off):**
- Text contrast: 0 text nodes under 4.5:1 on solid backgrounds (first pass found 4: links on the orange note and the Cancelled chip in dark; fixed). Text on photo stand-ins not measured (white on 55% black pill).
- Tap targets: 0 buttons/inputs under 44x44 (first pass found 2; fixed).
- Sideways scroll at 390: none on any screen. Page errors: 0. External requests: Google Fonts only.
- Tap walk: welcome &rarr; home &rarr; event &rarr; dates &rarr; date &rarr; cancel &rarr; undo restores &rarr; 26 dates (2027 shows year) &rarr; every section and back &rarr; course with week stepper &rarr; go live &rarr; home. All passed.
- No jargon: "series", "occurrence", "lifecycle" do not appear in visible copy.

**Verified:** the checks above; real event names/venues/times from prod. **Not verified:** real phone (Safari/Android), screen reader, text on photo covers, real stats/saves numbers, real profile names, BOS cadence, how a 2nd organiser's view differs (it shouldn't: all equal).
