# Handover: organiser stats strip, three stats only

## INVENTORY (strip stats the page could show BEFORE this change)
Mapping: src/modules/profile/organiserStats.ts (candidates array, pre-change lines ~188-256). Wrapper: organiserStatsByFeed.ts (ORDER, dash). Render: OrganiserProfile.tsx:859-872 (useMemo -> organiserStatsByFeed), :1288 (OrganiserStatsStrip).
1. next_night / last_night (:190-201) -- last_night removed
2. tickets_sold (:203) -- removed
3. dancers_came (:209) -- removed
4. nights_hosted (:215) -- kept
5. weekly_rhythm (:219) -- removed
6. running_since (:230) -- kept
7. venues (:249) -- removed
founded_year source: entity row `founded_year` read at OrganiserProfile.tsx:858 (entityFoundedYear); edited in the page's own form (:1516) and stored by the admin repo's organiser entity (schema authority: bachata-admin-11april; not read here).
Coverage: 8 pre-change stats -> 3 offered (next_night, nights_hosted, running_since); 5 removed.

## Done
- organiserStats.ts / organiserStatsByFeed.ts / OrganiserStatsStrip.tsx doc: three-stat rule, no Last night fallback, dead inputs/constants/helpers deleted.
- Three test files updated first (19 failures vs unfixed source), then green (7 files, 261 tests).
## Not done
- 390x844 laptop-walk screenshots (not run).

tsc run on 6df8670: 0 errors in branch files (grep of tsc output for touched files was empty).
