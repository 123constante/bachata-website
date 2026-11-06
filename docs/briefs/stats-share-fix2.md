# Brief: stats share card fix round 2 (review of PR #1428)

Brief-version: 2
Repo: website (123constante/bachata-website). Branch: claude/organiser-stats-v2-share-card (PR #1428, head 1475b9a3). Lane: normal, Sonnet. Continuation: fix round only, one bot push.

## What main lacks
- extends: ShareLinkCard uses organisers[0] not the chosen page; pass scope.selected (as StatsScreen.tsx lines 37-38 and 83 do) so page B shows B's link, code and next event -- #1428
- extends: one shared fact "has a live dated event" used by BOTH StatsScreen (line ~138, today it uses data.series.length, which includes ended series) and ShareLinkCard (lines 33-35, Copy disabled unless nextUpOf finds a live event); put the mapping in src/modules/organiser/p3/data/ -- #1428
- extends: ShareLinkCard says "switched off, ask the team" also when there is simply no code; separate "no link yet" from "switched off" -- #1428
- extends: StatsScreen help text "one person counted once a day" is false across events (sumAnalytics sums per series); reword truthfully -- #1428

## Files
src/modules/organiser/p3/screens/ShareLinkCard.tsx (new)
src/modules/organiser/p3/screens/StatsScreen.tsx
src/modules/organiser/p3/screens/__tests__/statsShare.matrix.test.tsx (new)
src/modules/organiser/p3/data/analyticsV2.ts (new)

New shared mapping file may be added under src/modules/organiser/p3/data/ (any new name, plus its test).

## What to build (test-first: new rows must be RED against head 1475b9a3, then green)
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line; report the coverage count at the end.
1. Two-page test row: scope.selected = page B; ShareLinkCard shows B's code and B's next event, never A's.
2. One shared "has a live dated event" fact. Table rows: ended-only + 0 views; ended-only + views; live event; no code. Rule: StatsScreen never says "Copy your link above" while Copy is disabled; the empty-state text says what the person CAN do.
3. Prod read-only check already done (Supabase stsdtacfauprzrdebmzg, counts only): organiser_profiles total 50, null/empty share_code 0, share_code_disabled_at set 0. A null code does not occur today, so "no link yet" is a defensive state: wording e.g. "Your link isn't ready yet. Try again shortly." and keep "switched off" only for disabled=true. Put these counts in the PR body Shapes surveyed line.
4. Help text: reword the "one person counted once a day" sentence to what the numbers truly are (counted once a day per event).
5. statsShare.matrix.test.tsx line ~43: replace the raw ellipsis character with a \u2026 escape.

## Out of scope (do NOT fix; state in PR body)
- One refused series blanking the whole Stats screen and role limits: follow-up, list under Not verified.
- Disabled-button contrast: disabled controls are exempt from the 4.5 rule; say so.

## PR body
Keep the "## Verified on real data" and "## Phone QA" sections (label `- Shapes surveyed:`, size 390x844). Not verified: real organiser data, real phone. One push, never add run-ci.
