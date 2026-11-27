# Brief: review-1244-r1 (WEBSITE, READ-ONLY REVIEW, Opus; builder was Sonnet). Branch claude/review-1244-r1 -> docs/review/pr-1244-r1.md only.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY.

Review PR #1244 (branch claude/claim-edit-fix-r1, handover docs/briefs/claim-edit-fix-r1-handover.md on that branch; brief it was built from: git show origin/brief/claim-edit-fix-r1:docs/briefs/claim-edit-fix-r1.md). Diff: `git diff origin/main...origin/claude/claim-edit-fix-r1`.
Risk: it adds a "Photos for every date" field on Details that writes `series.upsert` `default_gallery` (existing command) and moves the edit rows on the event page. Find CORRECTNESS bugs only, with file:line and a failing input:
1. Does saving Details with an untouched gallery send NOTHING for gallery? Does adding/removing photos send exactly the new list (not a partial, not duplicates)? What happens to existing per-date photo overrides and to a series whose default_gallery is null / empty / > cap (30)?
2. Upload happens before Save: failed upload, upload then Leave, upload then Undo: orphan or wrong state? Double-tap, slow network.
3. Any other field accidentally included/omitted in the same upsert (cover, ticket link) -> data loss? Compare the payload builder before vs after.
4. saveWordsFor/hasOneDate: events with exactly one date vs one date + cancelled/past dates vs series with 0 dates; wording must never claim "every date" falsely or "Save" when many dates exist.
5. EditRows move: any route/aria/test-id regression; keyboard focus order; copy that points at a control not on screen.
6. Shape table: weekly 30, weekly 16, one-off 1/2 dates, draft, ended, cancelled date, no sessions, no gallery, 10 photos, 31 photos.
Deliverable docs/review/pr-1244-r1.md: verdict PASS / PASS WITH NITS / BLOCK, findings ranked, each with file:line, failing scenario, suggested fix; honest Verified / Not verified (run `npx vitest run src/modules/organiser/p3` and report counts). Commit subject ends [worker-done <ticket>].
