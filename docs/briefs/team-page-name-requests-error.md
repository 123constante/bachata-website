# Brief: Team screens name the page; a failed requests read says so (P3)
Brief-version: 2
Branch: claude/team-page-name-requests-error
Lane: normal, Sonnet. Website only, no database change, no product choice.
Serves: a page-holder who adds a teammate or answers a join request.

## What main lacks
- In P3 the Team title is "Team" and Add someone is "Add someone"; the chips are R1-only (`kind === 'r1'`), so a holder of two pages cannot tell which team they are changing; the Done line is "X is a Manager" -- grep: p3-team-page-name
- The join-requests query on Team and You never reads `isError`; a failed read looks like "no requests", so a waiting person is never answered -- grep: p3-team-requests-error
- Prod today: 0 users hold 2+ pages besides one staff account, so test with fixtures -- extends: src/modules/organiser/team/index.tsx

## Files
- src/modules/organiser/team/index.tsx, src/modules/organiser/team/AddSomeone.tsx
- src/modules/organiser/p3/you/YouScreen.tsx (requests block only, ~L80-102)
- tests: extend src/modules/organiser/p3/you/__tests__/you.matrix.test.tsx; new `teamPageName.matrix.test.tsx` under src/modules/organiser/team/__tests__/

## What to build
1. When `kind === 'p3'` and the person has 2+ pages, show the page name as a one-line caption under the title on Team and Add someone (`data-testid="p3-team-page-name"`, text-sm, truncates). One page: nothing added.
2. The Done message after adding names the page: "X is a Manager of <page>" (2+ pages only).
3. On Team and You, if the requests query `isError`, show "We couldn't load join requests." with [Try again] (`p3-team-requests-error`, refetch, 44px). A contributor's `not_authorised` stays silent (no card, no error).
4. Compact density, no new colours (existing p3 tokens).

## Tests (red first)
Table: pages {0,1,2,3} x roles {owner, manager, contributor} x requests {ok-empty, ok-2, error, not_authorised} on Team, Add someone, Done and You. Long page name truncates without sideways scroll. Retry refetches once.

## Done when
Matrix green, team/switch/you suites (176 tests) green, Verified / Not verified in PR body (no real two-page account exists).
