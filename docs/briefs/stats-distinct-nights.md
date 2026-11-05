# Brief: Nights hosted must count distinct nights (PR #1391)

Branch: claude/organiser-stats-mapping (Website). One review finding, normal lane, Sonnet.

Finding (confirmed): src/modules/profile/organiserStats.ts, the "Nights hosted" stat (stat 4) uses `past.length`, which counts one entry per occurrence. Two events on the same night count twice. The weekly-rhythm stat already de-duplicates through a Set, so the two stats disagree on the same data.

Do exactly this:
1. Red first: in src/modules/profile/__tests__/organiserStats.matrix.test.ts, in the `nights hosted` describe block, add a test: 5 occurrences on only 3 distinct nights (for example 2026-05-01 x2, 2026-05-08 x2, 2026-05-15) must NOT yield `nights_hosted`; adding two more distinct nights (2026-05-22, 2026-05-29) must yield value '5'. Run it against the unfixed code and see it fail.
2. Fix: compute `const hosted = new Set(past).size` and use `hosted` for both the `>= NIGHTS_HOSTED_MIN` check and the formatted value.
3. Run the whole organiserStats matrix test file and `npx tsc --noEmit`; all green.
4. Do NOT change the isPast / "Tonight" handling: the server flag carries the 6-hour grace on purpose.
5. Commit, push the same branch, stop. Touch no other file.

Files go through scripts/safe-edit.py (the file-write hook refuses raw edits over 2 KB).
