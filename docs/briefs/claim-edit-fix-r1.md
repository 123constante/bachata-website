# Brief: claim-edit-fix-r1 (WEBSITE, normal lane, Sonnet). Branch claude/claim-edit-fix-r1. One slice, one push.

Context line: stay under 35% of your context; at 45% start nothing new; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. NO database changes: use existing commands/RPCs only; if a gallery-for-all-dates command does not exist, STOP that item, say so in the PR body, and do the others.

## Read first
`git show origin/claude/walk-seven-edits:docs/walk/seven-edits-r1.md` (code-read of the seven minimum edits; owner needs: description, flyer, gallery, sessions, people, levels, tickets, mostly on WEEKLY recurring events). Files: src/modules/organiser/p3/screens/{EventPage,DetailsScreen,PricesScreen,EditTray}.tsx, p3/model/labels.ts, p3/screens/DateFieldSheets.tsx (PhotosSheet).

## Do exactly these four items (nothing else)
1. **Gallery for every date** (friction High 1): add a Photos row/field on Details (after cover photo) that sets the gallery for all dates, reusing the PhotosSheet upload path and the existing series gallery command (see tests seriesGallery.matrix.test.tsx, data/dateFields.ts ws.gallery). Same Save button, same toast pattern ("Saved for every date. Dancers see it now."). Per-date photos stay as they are.
2. **Edit rows to the top** (High 2): on the event page move the edit-rows card ("Name and details", "Prices", etc.) ABOVE Sessions and Coming up, so description/flyer/ticket link are reachable without scrolling past the lists. Keep Sessions and Coming up below.
3. **Field order on Details** (Med 6): name, about (description), cover photo, gallery, ticket link first; the rest (where, level, etc.) stay below under a "More details" group if the existing pattern allows; do not remove any field.
4. **One-date save wording** (Med 5): when the event has exactly one date the Details/Prices Save says "Save" (not "Save for all dates"); toast "Saved. Dancers see it now."

## Rules
- Plain words, same word for the same thing ("Photos", not Photo/Gallery mix on one screen). Copy names only controls on screen. British English.
- Taps >= 44px (explicit px; phone html font-size trap), body text >= 16px, no sideways scroll, nothing clipped, light and dark.
- Table-driven vitest: Details/EventPage x shapes (weekly with 30 dates, weekly 16, one-off 1 date, one-off 2 dates, draft, ended, with/without sessions, no gallery, 10 photos); one shared label mapping; red first; an untouched save sends nothing. Update snapshots deliberately.
- Source files over 2 KB: scripts/safe-edit.py. Entities (&mdash; etc.), never raw unicode punctuation.
- Run every applicable CI job step (read .github/workflows). PR body guard lines exactly `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and `## Phone QA`.
- Walk with `node ~/.claude/bin/laptop-walk.mjs` if available in your sandbox; if not, say so honestly (the orchestrator walks).

## Done = pushed, PR opened by bot, handover note, head SHA, per-job check table, honest Verified / Not verified. Final commit subject ends [worker-done <ticket>].
