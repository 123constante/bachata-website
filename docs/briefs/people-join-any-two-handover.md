# People join any two: handover

Branch claude/people-join-any-two. Block "Join two people" on /admin/organisers, under DuplicatesAlert.

## Done
- joinSearchApi.ts: admin_search_people_v1 (archived included), pairFrom(keep, fold) -> DuplicatePair (null for same id / missing side).
- JoinTwoPeople.tsx + joinTwoCopy.ts: two search slots, swap, "See what will change" (disabled with a reason until two different people).
- DuplicateReview: optional startAt ('changes') and onJoined props; defaults unchanged. Preview = existing dry run; real run only from "Yes, join them". After join both slots clear, DUPLICATES_KEY invalidated by the review.
- Tests: __tests__/join-two-people.test.tsx (22) - Florian shape, every refusal code, already_done, empty list, archived, zero results, search error, untouched = no RPC, every preview p_dry_run true.

## Gaps (not in the brief's reach)
- admin_search_people_v1 returns no Instagram, city name, or team-page count. The result row shows name, login yes/no, archived, roles. Adding the rest needs an admin brief (RPC change); not done here.
- No unit check for bundle budget run (no build); the page is already lazy (AnimatedRoutes lazyWithRetry), the new files ride its chunk.

## Next
- Lead: dry run on the real Florian pair with an admin session; 390x844 walk.

tsc run on aa12d81: 0 errors in branch files (tsconfig.app.json).
