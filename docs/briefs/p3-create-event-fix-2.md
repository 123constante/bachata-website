# Brief: P3 create-event, fix round 2 (branch claude/p3-create-event-build, PR #1208) (NORMAL lane, Opus)

Context cap 50%. Never merge/approve. Push ONCE; final subject ends with the [worker-done <ticket>] marker named in the dispatch prompt.

## Defect found by the lead's walk at 390x844 (screenshot of /account/p3/create)
1. On the kind picker the "Coming soon" pill OVERLAPS the description text on the Course ("...8 Tuesdays"), Festival ("...a line-up") and Online tiles, so the last text line is half-hidden behind the pill. src/modules/organiser/p3/new/create.css has a comment about keeping the pill inside the card, but the text and the pill still collide. Fix so the pill sits BELOW the text in normal flow (never absolutely positioned over it), tile height grows to fit, taps stay >= 44px, nothing clips at 390x844 or at 360x740 and 430x932.
2. Add a test that fails when a coming-soon tile's pill and description overlap (use real layout via the e2e/playwright spec if the repo has one for p3-create, else a table-driven test on the rendered structure: pill is a later sibling in the same flow container, no `position:absolute`). Red first.
3. Walk it yourself at 390x844, 360x740, 430x932 (all nine tiles) and put the screenshots in docs/design/p3-create-event/walk/. Look at every picture.
4. Do NOT add features and do NOT build the deferred kinds.
