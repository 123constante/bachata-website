# Brief W2 (Website): sessions by kind on the draft + compact go-live card

Branch `claude/event-creation-w2` FROM `main` AFTER Website #750 and admin #780 AND admin A2 (roles migration) are merged (the dispatcher confirms). Push ONLY this branch. Open NO PR.
**Keep your session context under 35% (owner rule): read only what you edit, tail logs to 40 lines, commit and push early, leave the handover before ~30%.** Write shell commands WITHOUT variables, loops or `$(...)`. Check a PRODUCTION build. Read repo files with git, not `gh api`.
Hard rules: `src/lib/eventCategory.ts` byte-identical; never touch the calendar density-excluded files; `&hellip;` in JSX; explicit px tap targets; compact density.

## What and why
After New event creates a bare draft (W1), the organiser builds its programme on the draft. Owner decisions (settled): d36 FOUR session kinds only: Class, Masterclass, Party, Performance (label stays "Performance"; "Workshop" is NOT a kind). Each session has title, start/end time, level (Class and Masterclass ONLY) and people. d37 ONE ROLE PER KIND, mirrored in the database by A2: Class and Masterclass take Teacher only, Party takes DJ only, Performance takes any dancer profile (role `dancing` in `organiser_search_people_v1`, stored as profile_type dancer / role `dancer`). MC stays team-only. A session is added by ONE button per kind. The go-live checklist lives ONLY inside the Send for review card: compact "Send for review  2 of 5", a thin progress bar, ONE "Next: Venue [Add]" line (the Send button replaces it when all done), and a "See all steps" toggle that opens the full list (Name, Date and time, Venue, Add a session, Cover). Send for review is disabled WITH the reason until the steps are done.

## Build
1. New `src/modules/organiser/shared/sessionKinds.ts`: ONE table `SESSION_KINDS` = key, label, `ROLE_FOR` (picker role), `levelApplies`. Every screen and test reads it (no second copy). Reuse `programmeModel.ts` (`PEOPLE_ROLE_LABEL`, level helpers) instead of re-deriving.
2. Editor programme UI (`EventEditorPage.tsx`, `EditorGroup.tsx`/`EditorRows.tsx`/`EditorSheet.tsx` as needed): four "Add a ..." buttons, the session sheet (title, start/end, level for Class/Masterclass, people picker with exactly the kind's role). Save via the existing programme commands (`saveOccurrenceProgramme`/`seriesCommands`); saving an untouched session sends NOTHING.
3. `ReviewCard.tsx` + `reviewModel.ts` + new `GoLiveChecklist` component: the compact card above; `reviewModel` blockers become the ticked steps (one source).
4. The picker never offers a role the kind does not take; a role mismatch from the server is shown as the plain server message.

## Files you own
`ReviewCard.tsx`, `reviewModel.ts`, new `GoLiveChecklist.tsx`, new `sessionKinds.ts`, programme UI under `events/` that you create (name new files `Programme*.tsx`), `shared/programmeModel.ts` (additive only), their tests. You MAY touch `EventEditorPage.tsx` for wiring only (W3 edits other parts: keep your hunks small and say which). W1 owns the create page; W3 owns lists and the Type row.

## Verify (all required)
Red-first tests + a mutant per rule; matrix: 4 kinds x {role picker offers exactly one role, level shown/hidden, empty state says what to do, save untouched = no command, save changed = one command} x checklist states (0..5 of 5, venue missing, cover missing, no session). Prod shapes: series with 163 teaching + 1 djing on classes, 78 djing + 1 teaching + 1 mc on parties (the mismatches are GRANDFATHERED: they must display and save untouched without error). Run EVERY CI step (GitHub Actions + yourself), 390x844 production-build walk on the branch DB with A2 applied there, else NOT verified. Write `docs/handover/event-creation-w2.md`: checks table, Verified / Not verified, new-logic lines.

## PR rule (owner-approved hard-tier changes need a BOT-authored PR)
This branch name starts with `claude/` ON PURPOSE: `.github/workflows/bot-pr.yml` opens the PR AS THE BOT when you push, so the owner can approve hard-tier changes. NEVER open the PR yourself (a PR under the owner's login cannot be approved by the owner and reds `Owner approval audit`; that is what happened to #750). After the bot opens it, fill the body with `gh api -X PATCH` using the template headings `## Verified on real data` (lines `Shapes surveyed:`, `Checks run:`, `NOT verified:`) and `## Phone QA` (lines `Sizes checked:` with a WxH, `Walked:`, `Not verified:`). Workers push only.
