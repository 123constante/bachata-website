# Brief: claim-edit-fix-r2 (WEBSITE, normal lane, Sonnet). CONTINUATION on claude/claim-edit-fix-r1 (PR #1244). ONE fix round, one push.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. NO database changes.

Read the independent review: `git show origin/claude/review-1244-r1:docs/review/pr-1244-r1.md` (verdict BLOCK, 5 findings, file:line each). Fix ALL five, red first (a failing test for each before the fix; F1 and F2 need a test with the upload promise held open):
1. F1: pass `busy={save.busy || pics.busy}` (and cover `photo.busy`) to EditTray so Save and Undo are disabled while an upload runs; make the leave guard ask when an upload is in progress (`useBackToEvent(..., form.dirty || pics.busy || photo.busy)`); mirror PhotosSheet (DateFieldSheets.tsx `uploading`).
2. F2: append with the functional setter (`form.setDraft(d => ({...d, gallery: [...d.gallery, url]}))`), never a stale `list`; Add photos and Undo disabled while `pics.busy`.
3. F3: copy must not claim "every date" when some dates have their own photos. Hint: "Shown on every date that has no photos of its own." Toast after save: keep it true (e.g. "Saved. Dates with their own photos keep them."). One mapping in labels.ts, one matrix row "series gallery + 2 dates with own photos".
4. F4: if picked files exceed the cap, show the existing cap message (datePhotosMax) as the error instead of dropping silently.
5. F5: a series with 0 dates: "Save" / "Saved." in model/saveWords.ts (treat listed <= 1 and total <= 1 as plain).
Rules: plain words, same word for the same thing, entities not raw unicode punctuation, scripts/safe-edit.py for files over 2 KB, update snapshots deliberately. Run `npx vitest run src/modules/organiser/p3`, tsc, `npm run lint`. Fill the PR #1244 body (it is still the bot stub): lines exactly `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and a `## Phone QA` section (say honestly what was not walked; the orchestrator walks). Final commit subject ends [worker-done <ticket>].
