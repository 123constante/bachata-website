# Brief: onboarding prototype, ROUND 2 (owner picks + no-scroll rule)

Same branch/files as before: `docs/design/onboarding-prototype.html` and `.md` on claude/p3-onboarding-prototype (PR #1124); continue ON it. Earlier briefs: `briefs/p3-onboarding-prototype.md` (brief/p3-onboarding-prototype) and the review `docs/review/onboarding-prototype-r1.md` (branch claude/review-onboarding-prototype).

The owner tried the prototype and decided (binding):
- Corners = SOFTER / PILL-LIKE (buttons fully rounded, cards generously rounded). Text = SHORT (titles and labels; one tiny helper line at most). Mood = CALM. Make these the defaults; keep the Design options drawer but mark these as "Chosen".
- Drop the "Not sure yet" dance role card: only Leader, Follower, Both.
- NO SCROLLING: every onboarding screen's content must fit one phone page with NO page scroll at 390x844, at 360x640 and at 320x568, also at 130% text and with the on-screen keyboard open (field and the big Continue button move up above the keyboard; the title may shrink or collapse). ONE QUESTION PER SCREEN: split every multi-question screen (you / contact / teach / about / email / your page / review) so each screen has a single question or a single choice group, one primary button. Progress becomes a thin bar (or dots that compress) so 12+ screens still read as quick. Back everywhere, skippable optional ones still skippable.
- Nationality and languages: a search box plus about 6 popular big chips; the full list lives in a picker sheet (the sheet itself may scroll internally); chosen values show back as chips. Dance roles, levels, categories: big tap cards that fit without scroll (max 4 cards, 2x2 grid if needed).
- The Review ("N things left") screen must also fit one page: show counts and the single next missing item with a "Show all" sheet.
- Home and Settings screens are not onboarding: they may scroll, but state it.

Checks you must run and put in the .md (measure, do not assert): for EVERY screen and state, at the three viewport sizes, 130% text, and keyboard open (simulate a reduced visual viewport): document scrollHeight <= innerHeight, no clipped text, tap targets >= 44px, contrast >= 4.5 light and true-black dark, reduced-motion path. Provide a table screen x size with measured numbers. A screen that cannot fit is a defect you fix by splitting it again, never by shrinking text below 14px.
Keep the file offline, under 600 KB, no new scope (ideas to Parked). Push once at the end; subject ends [worker-done <ticket>]. Context under 35%.
