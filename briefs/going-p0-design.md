# Brief: Going P0 -- shape survey + design options (Design Gate stages 1-2). NO product code.

Model: Opus. Branch `claude/going-p0-design` from origin/main. Output = docs + standalone HTML mockups only.

## Owner decisions (2026-10-23, binding, do not re-open)
1. Visitors see COUNT + FACES on a night: "12 going" + small photos of dancers who opted in; tap a face -> their dancer page.
2. Only FINISHED profiles may say going (first name, city, role, photo = `profile_complete_v1`), enforced by the database.
3. Going = ONE specific night (occurrence), never the whole series.
4. Organisers see who is going to their events (count + opted-in faces).
5. ONE privacy switch "Show me as going" (OFF by default) controls faces on events AND "Going next" on the dancer page.
6. NO "Interested" button any more: one "I'm going" button.
Earlier: F13 public dancer page "Going next" (1 card full width / 2 side by side / 2 + "See all N") is already chosen.

## Part 1: shape survey (Supabase connector, READ-ONLY, counts only, no personal data)
Prod project stsdtacfauprzrdebmzg. Write `docs/going/shape-survey.md`: live public nights in the next 60 days by type
(weekly series / one-off / festival), per-night going counts distribution, dancer profiles complete vs incomplete
(`profile_complete_v1`), how many have a photo, nights ended/cancelled, festivals with one vs many occurrences,
organisers with live events. Use these numbers to pick realistic mockup data (0, 1, 3, 9+ faces).

## Part 2: design options
Read `DESIGN.md` / design tokens and the live event page, festival hub and dancer app code (src/modules/event-page/bento,
src/pages/FestivalHub.tsx, src/modules/dancer-app) so mockups use the REAL site look (dark theme, Bachata Amber, compact density
per `.claude/rules/design-density.md`, explicit px tap targets >= 44px because html font-size is ~13.5px on phones).
Make 3 named whole-feature options (A/B/C), each ONE standalone HTML file at 390px wide in `docs/design/going/`, each showing:
- Event page Going block in every state: signed out, signed in with unfinished profile (says what to do + link), can tap,
  I'm going (with how to undo), night ended, night cancelled, 0 going, 1 going, 3 faces, 9+ faces (+N), me opted out but going.
- Festival hub night row with count + faces.
- Dancer settings: the "Show me as going" switch with one honest line on what it shows and where.
- Dancer app "My nights" list (upcoming / past).
- Organiser view: per upcoming night count + opted-in faces (mobile).
Every empty state says what the person can do; every disabled control says why. Also `docs/design/going/brief.md`
(5-line Design Gate stage-1 brief) and `docs/design/going/README.md` comparing A/B/C in plain words for a beginner owner.
No changes outside docs/. Do NOT push again after your final commit + handover `docs/handovers/going-p0-design.md`.
