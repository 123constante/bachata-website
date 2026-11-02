# Review r1: Website PR #1282 (organiser public page S1, error state)

Read-only review. No src edits, no prod writes (Supabase SELECT counts only). Branch under review: claude/organiser-public-s1-errors. Write findings to docs/review/pr-1282-r1.md on your own branch, push, stop.

Judge:
1. Fetchers throw on RPC error; a real empty result still returns []. Any caller that relied on the swallow?
2. SSR loader app/routes/organiser.tsx: failed feed not dehydrated, payload untagged so no edge cache. Read cacheHeaders and prove a failed feed cannot be cached at the edge; prove an all-ok page keeps its cache tag.
3. OrganiserProfile.tsx: no empty-state box while any feed failed; past and upcoming fail independently; legacy base-date fallback skipped on failure. Real empty organisers (no events, past-only, owner-blank) still show the same wording.
4. Mutants (run the two new test files, report fail counts): M1 fetcher returns [] on error; M2 loader tags payload even when a feed failed; M3 empty box shown while failed; M4 Try again does not refetch.
5. Retry button 44px, px sizes, no raw unicode punctuation in added src lines.
Report F-numbered findings, most severe first, with file:line. Context cap 30%.
