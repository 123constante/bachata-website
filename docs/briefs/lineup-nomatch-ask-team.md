# Brief: line-up search with no result gets a way to ask the team
Brief-version: 2
Branch: claude/lineup-nomatch-ask-team
Lane: normal, Sonnet. bachata-website only (src/modules/organiser/p3/screens/LineupSheet.tsx only for product code); must not touch supabase/**, src/lib/contactLinks.tsx, or any calendar density-exclusion file.
Serves: an organiser building a session line-up who searches for a teacher or DJ who is not on the calendar yet; today the sheet says to ask the team and offers no control (walk W-10, claude/walk-dancer-view-after-edit docs/walk/p3-walklist-1/RESULTS.md).

## What main lacks
- extends: the no-match note says "ask the Bachata Calendar team to add them" with no control on screen -- src/modules/organiser/p3/screens/LineupSheet.tsx
- an "Ask the team to add them" link on the no-match state, opening the team's WhatsApp chat with a message that names the searched text and the event -- grep: p3-lineup-ask-team
- the message wording constant for that chat -- grep: LINEUP_ADD_PERSON_MESSAGE

## Files
src/modules/organiser/p3/screens/LineupSheet.tsx
src/modules/organiser/p3/screens/__tests__/lineup.nomatch.matrix.test.tsx (new)
docs/arcs/organiser.md

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. In the no-match branch (LineupSheet.tsx, data-testid p3-lineup-nomatch) render an anchor, data-testid p3-lineup-ask-team, at least 44px high, href built with the existing `dancerMessageUsUrl` from src/lib/contactLinks.tsx (import it; do not edit that file), opening in a new tab with rel noopener. Message: "Hi! I'm adding a line-up on Bachata Calendar and cannot find: <searched text>". Define the message constant LINEUP_ADD_PERSON_MESSAGE in LineupSheet.tsx (labels.ts is held by claude/p3-broken-image-states-r2, do not edit it).
2. Leave the existing `noMatch` words as they are (they already say to ask the team) and put the link right under them. The link shows only when the search text is long enough to have searched (PEOPLE_SEARCH_MIN) and the search did not error.
3. Update the Website arc row in docs/arcs/organiser.md (Status, Blocked by, PR link) in the same PR: add a row "Line-up no match offers Ask the team" for this slice.

## Tests
Table-driven, red first (run against unfixed main): search state {under minimum length, results found, no match, search error, session that takes no people} x role {teacher, DJ}. Each cell asserts: the link exists only for no match, its href contains the encoded searched text, no text points at a control that is not on screen, no sideways scroll classes added.

## Done when
- Matrix green; existing sessions.send and sessions.data tests green; tsc clean on changed files; every applicable CI job step run.
- Walked at 390x844 on the no-match shape; screenshot attached to the PR.
- PR body has a Verified / Not verified block (Not verified: a real phone, a real WhatsApp hand-off).
