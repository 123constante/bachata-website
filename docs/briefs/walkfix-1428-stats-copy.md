# Walk fix #1428: Stats share card says "Add an event" when drafts exist

Brief-version: 1
Branch: claude/organiser-stats-v2-share-card (continue the existing branch and PR #1428; do not open a new PR)
Lane: normal, Sonnet. Max 3 files, no migration.

## What main lacks
- Draft-only account (walked 390x844, 11 draft events, 0 live) sees "Add an event to get a link" and "Add an event first". Live events are what unlock the link -- proof: grep: `noEvent: 'Add an event to get a link'` at src/modules/organiser/p3/data/shareState.ts:25 and `Add an event first. Views start` at src/modules/organiser/p3/screens/StatsScreen.tsx:143

## Build
0. INVENTORY.md not needed (copy-only); list the two strings and their tests, covered/total.
1. Change the noEvent reason to "Put an event live to get a link" (shareState.ts) and the Stats no-views line to "Put an event live first. Views start once an event is on the calendar." Keep British English, entity-escaped punctuation.
2. If the shape is cheaply known, give the draft-only case its own wording ("Your events are still drafts. Put one live to get a link"); otherwise one wording for none / draft-only / ended-only is fine, but it must not say "Add".
3. Update the existing expectations in screens.matrix.test.tsx (lines ~310, ~527-528) and statsShare.matrix.test.tsx (NO_EVENT, WITHOUT).

## Tests (table-driven, red first)
Add a unit test of the empty-state mapping (shareStateOf + SHARE_REASONS + the Stats none line) over three shapes: draft-only (events exist, none live), none (no events), live (event live -> ready, Copy enabled, no empty copy). Assert no string says "Add an event" while the person has drafts, and every empty text says what the person can do. Run against unfixed code first (red).

## Hard limits
- Website repo only; no supabase/migrations; Supabase read-only; no workflow edits, no .env*; HTML entities not raw Unicode; push once to the existing branch (bot PR already exists); run every CI job step; never --no-verify; end with [worker-done walkfix-1428].
- Update the PR body "Verified on real data" block honestly; copy fix verified in tests, 390x844 re-walk is the lead's.
