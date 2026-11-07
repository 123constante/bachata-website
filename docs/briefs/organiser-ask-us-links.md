# Brief: organiser screens that say "ask the team" get a real Ask link (venue, repeat, festival sessions)
Brief-version: 2
Branch: claude/organiser-ask-us-links
Lane: normal, Opus. Repo 123constante/bachata-website. One PR. Screen change, no migration, no hard-tier path.

## Goal
Three organiser screens tell the person to ask the team but offer no control, so they are dead ends. Give each the same real "Ask the team" link that PR #1464 gives the line-up sheet (a WhatsApp message opened with `dancerMessageUsUrl` from src/lib/contactLinks), so an organiser with an unlisted venue, a locked repeat pattern or a festival programme can actually ask.

## What main lacks
- an Ask-the-team link under "No venue matches" in the event editor -- grep: org-venue-ask-team
- an Ask-the-team link on the locked Repeat sheet note (adminOnly and review) -- grep: p3-repeat-ask-team
- an Ask-the-team link on the festival sessions note -- grep: p3-sessions-ask-team

## Files
- src/modules/organiser/events/EditorSheet.tsx
- src/modules/organiser/p3/screens/RepeatSheet.tsx
- src/modules/organiser/p3/screens/EventPage.tsx
- src/modules/organiser/p3/screens/__tests__/askTeamLinks.matrix.test.tsx (new)
- a short design record docs/design/<pr>.md (new)

## Evidence on origin/main (2026-11-07; re-grep before editing, line numbers drift)
- EditorSheet.tsx:270 `No venue matches. Ask the team to add it.` plain text, no control. `supportLinks()` (src/modules/organiser/shared/support.ts:13) exists but is env-dependent and may return null; `dancerMessageUsUrl` (src/lib/contactLinks) is the helper already used by auth-otp-routing and the city picker.
- p3/model/repeat.ts:97 (adminOnly) and :100 (review) say "Ask us"/"ask the Bachata Calendar team"; rendered as a plain `p3-note` at RepeatSheet.tsx:242 (`p3-repeat-why`). The `ended` and `archived` lines also say to ask the team: include them.
- p3/model/labels.ts:211 `festivalAsk` rendered as plain text at EventPage.tsx:85 (`p3-sessions-ask`). labels.ts also has `askUs` and `askCity`: find where they render before touching them; if you cannot prove they are rendered, leave them alone.
- PR #1464 (open, touches only LineupSheet.tsx, its test and docs) uses `<a className="p3-link" target="_blank" rel="noopener noreferrer" href={dancerMessageUsUrl(MESSAGE + context)}>Ask the team to add them</a>`. Copy that pattern and its message-constant style; do not edit LineupSheet.tsx or import from it.

## What to build
0. Write INVENTORY.md first (in the design record or PR body, not the repo root): every place on the organiser screens (src/modules/organiser) whose copy tells the person to ask/contact the team, with file:line and whether it has a control. Build only after it exists; report the coverage count (places with a working control / places total). The three places above are the scope; list any others you find under "found, not fixed" in the handover.
1. For each of the three places add the link with a message that carries the context: the event name (and for venue, the searched text; for repeat, the event name and the reason shown). Link text says what happens ("Ask the team to add this venue", "Ask the team", "Ask the team to change the programme"). Open in a new tab with rel noopener noreferrer. Tap target at least 44px with explicit px (the site html font-size is about 13.5px on phones). Keep the existing words above it.
2. Pick the one design yourself (reuse `.p3-link` in p3 screens, the editor's own link style in EditorSheet) and record why plus one rejected alternative in two lines each in docs/design/<pr>.md.
3. Table-driven test, red first against the unfixed code: {venue no match, repeat adminOnly, repeat review, repeat ended, repeat archived, festival sessions} x {link present with a wa.me/api.whatsapp href, message includes the event name}; and: where venue DOES match, no ask link; where the repeat pattern is editable, no ask link. Assert no copy on these screens names a control that is not on screen.
4. Checks: tsc 0 errors in touched files; vitest src/modules/organiser; npm run check:mojibake. Use &mdash;/&rsquo; entities and \u escapes, no raw Unicode punctuation. Files over 2 KB go through scripts/safe-edit.py. Survey (read-only, counts only, Supabase MCP prod stsdtacfauprzrdebmzg): how many live series are festivals and how many are locked adminOnly/review/ended, for "Shapes surveyed".
5. PR body: "## Verified on real data" and "## Phone QA" with the exact labels. Push once with the [worker-done ...] marker.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, LineupSheet.tsx, supabase/**, migrations, workflows, scripts/**, .env*, src/lib/contactLinks.ts, any file not listed under Files.

## Done when
One push; branch merges cleanly with main; every CI job step that applies has been run and the per-job table is in the PR body; the PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); last commit subject ends with the [worker-done ...] marker.
