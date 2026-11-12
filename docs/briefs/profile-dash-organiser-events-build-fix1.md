# Events build fix round 1 (PR #1584, branch claude/profile-dash-organiser-events-build)
Normal lane, Sonnet, no migration. Continue on the existing branch (git fetch, check it out, do not recreate). Reviewer verdict on head 6ebbe448: nothing built is wrong; these gaps remain. Fix ALL, push once, end the last commit subject with the worker-done signal from your ticket.

## Fix list
1. Raw Unicode punctuation in src/modules/organiser/p3/events/eventsModel.ts (curly apostrophes lines ~29,33,34; curly quotes ~45,220; middle dot ~152): replace with \u escapes in TS strings (entities in JSX). Run `npm run check:mojibake` and grep the whole PR diff for non-ASCII punctuation.
2. Scope sheet: the brief asked for the existing scope sheet (this date only / every date) on cancel. Wire it where an existing command supports it; if no existing command supports "every date", disable that choice with a visible reason. Add tests.
3. "Cancel this night" in the night sheet must open the cancel step (reason picker) directly, not the date action list.
4. Disabled Cancel/Duplicate in NightSheet (EventsView.tsx ~261,264): add aria-describedby pointing at the visible reason. DeleteDraft confirm (DashEvents.tsx ~87) disabled while loading: show "Working..." text.
5. Toast says "Draft deleted" but the draft is archived and restorable: change to "Draft archived. Your team can restore it."
6. Tests: make the screen x shape tests one table (shared mapping, rows = shape: empty, drafts only, live, cancelled, past only, 100+ rows paged, contributor, manager; columns = what is shown, what is disabled and why, empty-state action). Add DashEvents tests: CancelNight loading / error / not-found, DeleteDraft error path. Remove the `|| true` assertion at eventsModel.test.ts ~392 (make it real), delete dead code (`rowsFor` ~285, `void timeKey` ~225, the no-op `.replace` ~215, unused NEEDS_ADMIN export or show it).
7. Empty list when every night is past and none shown: show an explicit empty state with an action (Show past events, Create a night).
8. Sticky needs strip: top offset must sit below the shell header (no overlap at 390x844). Confirm the empty-state copy "start from a photo of your flyer" matches a real create route; if not, reword.
9. Run the 390x844 walk with preview-deploy.mjs on the side laptop per the original brief; put screenshots (Home to Events, night sheet, cancel step, empty, 100+ rows) on the PR, and the per-job CI table. Run `npm run pre-ship` and paste the result. PR body: keep the `## Verified on real data` format (Shapes surveyed / Checks run / NOT verified).

## Done = all nine fixed, pre-ship green, CI green, walk shots on the PR, handover section updated in docs/design/profile-dash/organiser-events.md.
