# Brief W1 (Website): New event page = name + four format cards

Branch `arc/event-creation-w1` FROM `main` AFTER Website #750 and admin #780 are merged (the dispatcher confirms). Push ONLY this branch. Open NO PR.
**Keep your session context under 35% (owner rule): read only what you edit, tail logs to 40 lines, commit and push early, leave the handover before ~30%.** Write shell commands WITHOUT variables, loops or `$(...)`. Check a PRODUCTION build (`npm run build`), not only the dev server. Read repo files with git, not `gh api`.
Hard rules: `src/lib/eventCategory.ts` byte-identical; never touch `src/components/calendar/**`, `EventCalendar.tsx`, `useCalendarEvents.tsx`; `&hellip;` entities in JSX; explicit px tap targets (html font is ~13.5px on phones); no budget/pin/`vendor-ui*` raised; compact density (`.claude/rules/design-density.md`).

## What and why
The organiser New event page still asks Class/Party/Workshop (a leftover of the old dropdown). Admin asks One-off / Recurring / Course / Festival. event-truth now derives an event's Type from its sessions, so the New event page must ask only the FORMAT. Owner decisions (settled, do not reopen): d35 the "start with" row is REMOVED; d33 Course and Festival cards are shown GREYED, not selectable, with the reason "Ask the Bachata Calendar team to set this up."; d32 a duplicate name (same organiser, live or paused, case-insensitive) shows a QUIET NOTE under the name with an "Open it" link and NEVER blocks Create; d45 a party series reads "Party" on organiser screens.

## Build
1. `NewEventPage.tsx` + `newEvent.ts` + `eventType.ts` (create-side copy only): name field, four cards (One-off, Recurring selectable; Course, Festival disabled with the reason), Create. No category is sent (the server derives it). One-off = a bare draft with a single date slot as today; Recurring = the existing weekly rule. Remove the chips, the Class/Party/Workshop hints and the seeding of a first session by chip (sessions are added on the draft by W2).
2. Duplicate-name note: read from the organiser's already-loaded events list (`useOrganiserHome`/events list, no new RPC). Show only for live or paused events of the same organiser.
3. Keep every fix-1..7 behaviour: the lost-reply freeze, the same create key on resend, the City lookup failure message ("We could not look up your city; nothing was saved"), the blocked-organiser exit sentence. Change only what the chips removal requires, and say what.
4. Hints must never name a disabled control; every disabled card says why.

## Files you own (no other slice edits them)
`NewEventPage.tsx`, `newEvent.ts`, create-side parts of `eventType.ts` (the `EVENT_TYPES` chip table and `chipHint`), their tests, `tests/e2e/organiser-*` specs that touch the create page. W3 owns the editor Type row parts of `eventType.ts`: edit ONLY the chip table and `chipHint`.

## Verify (all required, before your last turn)
Red-first tests for each new rule (run against the base, say so) and a mutant for each; a table-driven matrix: 4 cards x {selectable, disabled+reason} x {name empty, name duplicate, name unique} x {online, lost reply, refused, city lookup fail}. Run EVERY CI step of every workflow (GitHub Actions runs on your push now: read the results with `gh api` REST, and also run the no-secret steps yourself); name env-only reds against the baseline. Walk 390x844 (production build) on the branch database `ozdodfwhlxpxgtqhaewa` if you can; else say NOT verified. Write `docs/handover/event-creation-w1.md` with a checks table (command, exit), Verified / Not verified, and which lines are new logic.

## Found in the #750 walk (390x844), carry into your work
- The old Class chip kept an AMBER OUTLINE after switching to Party (probably a focus or selected state, unconfirmed on a real phone). Your four cards must show exactly ONE selected state at a time; add a test that selecting another card clears the previous card's selected and focus styling.
- (The editor Type sub-line was clipped by 	runcate on a draft with no sessions: W3 removes that row, so no fix needed here.)
