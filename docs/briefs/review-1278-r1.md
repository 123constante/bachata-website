# Brief: independent review of PR #1278 (P3 save copy for drafts, v2) -- READ-ONLY, findings doc only

Repo 123constante/bachata-website. Review branch `claude/p3-save-copy-drafts-v2` (head c7cae99) against `main`. You did not build it. Write ONE file on branch `claude/review-1278-r1`: `docs/review/pr-1278-r1.md`. No source edits, no DB write (Supabase read-only, counts only).

## Read
`git fetch origin claude/p3-save-copy-drafts-v2`, `git diff origin/main...FETCH_HEAD`. Handover `docs/handover/p3-save-copy-drafts-v2.md`. First brief (owner wording and rule): `docs/briefs/p3-save-copy-drafts.md` on `brief/p3-save-copy-drafts`.

## Judge
1. Live column byte for byte equal to main's words for EVERY message (savedEvery, savedDate, addedEvery, addedDate, detailsSaved, detailsSavedOne, pricesSaved, save button, nothing-changed)? Diff each string against main.
2. Is `lifecycle_status` the right source on every screen that saves (Details, Prices, session sheet)? Which values really occur on prod (read-only counts)? Can the value be stale after the save itself (a save that publishes or unpublishes)? What does the toast say then?
3. Any copy that now points at a control that is not there, or claims "dancers see it" for ended/archived/cancelled/unknown? Is paused wording true (what does paused mean to dancers on the public site)?
4. Mutants (at least 4): flip live/draft in the mapping, drop `paused`, make unknown fall to live, swap oneDate. Report which the matrix tests fail to catch.
5. Removed `labels.ts` keys: any remaining importer, any other repo area or test still using them? Raw Unicode punctuation left in source (CLAUDE.md: HTML entities)?
6. Untouched save still sends nothing; no change to when saves are allowed.

## Output
Findings ranked most severe first: file:line, defect, concrete failing input, severity (blocks merge / fix before merge / nit), CONFIRMED or PLAUSIBLE. End with "Not reviewed". Zero findings is valid if you say what you checked. Context cap 30%; last commit subject ends with the done marker from your prompt.
