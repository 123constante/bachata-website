# P3 mockup C v2 - the owner's chosen direction, finished

The owner chose mockup C "Today first" on 2026-10-23 (over A calm and B photo-led). An independent reviewer then critiqued it. Your job: make C v2, the version the owner and 3-5 real organisers will tap through before anything is built. Same structure as C (Next up hero + quick actions, Needs you, stats, all events, tabs Home/Events/Stats/You, date strip with "this date only / this and later ones", sheets for confirms). Do NOT redesign.

Read first, in order:
1. `docs/organiser-rebuild/p3/DESIGN-COMMON.md` (binding owner answers and output rules) and `M-C-today.md` on this brief branch.
2. `git fetch origin claude/er-p3-mock-c claude/er-p3-critique-c claude/er-p3-mock-a claude/er-p3-mock-b`.
3. C: `origin/claude/er-p3-mock-c:docs/organiser-rebuild/p3/mockups/C.html` + `C.md` - your starting file. Copy it to `C2.html` and edit.
4. The critique: `origin/claude/er-p3-critique-c:docs/organiser-rebuild/p3/CRITIQUE-C.md`. Apply ALL 25 fixes and ALL 6 "Borrow from A/B" items. Where a fix offers a choice, pick the one that keeps one primary action per screen and say which in C2.md.
5. A.html / B.html only for the borrowed patterns.

Decisions already made (do not reopen):
- Cancel wording, everywhere: action "Cancel this date" / "Cancel these dates", chip "Cancelled", undo "Bring it back". Delete is admin-only: quiet line "Want it gone for good? Ask us".
- Stats: show VIEWS only ("views", one word everywhere). Saves: a quiet "Saves are coming soon" line, no saves numbers anywhere. No "updates every hour" claim.
- Dates: one formatter; far-year dates always "Wed 6 Jan 2027"; chips show month + a small "2027" marker on the first chip of a new year.
- Weekly social, one-off party and course create all use the same StepFrame and wording; disabled Next says why.
- Where, How to pay (tick: on the door cash / card / online link) and Ticket link are rows on the event page; the public preview shows ONLY what those rows hold; empty -> organiser-only "Not set yet - add it".
- Home after cancelling tonight / pausing shows the new state (chip + one "Bring it back" / "Turn back on" action), not only a toast. Toasts never cover a button.
- Inputs: hide the bottom bar and tab bar while an input has focus.
- Line-up header always names the event and which date(s); "changed" compares the set of people; "Add their name instead" when no profile.
- Invite journey: inviter's waiting state (Send again / Cancel invite) AND the invitee's first screen ("Jess invited you to run London Loves Bachata's events" -> Join -> Home).
- Help: a real "Message us on WhatsApp" button (wa.me placeholder link; do not put a real phone number).
- Data: read London Loves Bachata's live events from prod (Supabase connector, SELECT only, public fields: name, format, start time, venue, weekday/cadence). Show the real course shape (Sensual Wednesdays course) and a monthly event (Mambo City x LLB) correctly; the two events named "Sensual Wednesdays" get a second line that tells them apart. Line-up names may stay stand-ins (say so).

## Output (ONE push, no PR, no source edits)
Branch `claude/er-p3-mock-c2` from `origin/main`. Files:
1. `docs/organiser-rebuild/p3/mockups/C2.html` (self-contained like C; Google Fonts only).
2. `docs/organiser-rebuild/p3/mockups/C2.md` (max 60 lines): a table of all 25 critique items + 6 borrows -> done / how (one line each); new screens added; the shared labels list (every user-visible word for each thing); self-checks MEASURED with Playwright at 390x844 AND 360x640, light AND dark, plus keyboard-open simulation (layout viewport 390x514): text contrast >= 4.5, taps >= 44px, no sideways scroll, nothing under a bar, 0 console errors; a scripted re-run of the critique's logic probes (items 1, 2, 3, 8, 9, 10, 11, 19) with results; Verified / Not verified.
