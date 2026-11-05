# BRIEF: p3-status-real-reasons (WEBSITE; branch `claude/p3-status-real-reasons`; normal lane, Opus; no database change)

Brief-version: 2
Owner screenshot 2026-11-05: the Status sheet on a DRAFT event says "It is not ready to go live yet: it needs a cover photo, a date coming up and its details" although the cover exists. You never merge or approve, write no prod data (Supabase connector read-only, counts and ids only).

## Measured cause (prod, read-only, series 7f0236e5 East London Bachata Monthly Party)
The event side is fully ready: cover, venue, GB city, 12 upcoming dates, 2 timed sessions, payment=door; `event_publish_readiness_v1` ok. The real blocker is the PROFILE rule in `_series_go_live_check_p5`: organiser 2631450a is missing required field `founded_year`. The Website maps EVERY `permission_denied` from `series.set_lifecycle` to one fixed sentence (test `src/modules/organiser/p3/screens/__tests__/eventPage.matrix.test.tsx` around line 419), so the screen blames the cover.

## What main lacks
- extends: a go-live refusal that names the real missing items (event_missing and profile_missing from `series_go_live_check_v1`) instead of one fixed sentence, with Put it live disabled and a reason -- src/modules/organiser/p3/data/eventPage.ts

## Files
- src/modules/organiser/p3/data/eventPage.ts (STATUS_COPY, the go-live reason around line 254)
- src/modules/organiser/p3/screens/StatusSheet.tsx
- wherever `commandErrorMessage` lives (grep it) and its tests
- src/modules/organiser/p3/screens/__tests__/eventPage.matrix.test.tsx
- one new test file for the table below
- docs/handover/p3-status-real-reasons.md
Do NOT touch the organiser create/edit wizard, onboarding, or any other P3 screen (website-1a owns them).

## What to do
1. Read first, read-only on prod: call `series_go_live_check_v1` through the Supabase connector for the draft series above and one ready series; record the exact keys it returns (event_missing items, profile_missing items, field names). Do not guess names.
2. On a go-live refusal (and BEFORE the tap if the check is cheap and already loaded), show the real reasons in plain words: `profile_missing founded_year` becomes "Add the year you started to your organiser page"; cover, date and details items from `event_missing` each in their own words; never server text. Put it live stays disabled with the reason shown. The empty state says what the person CAN do.
3. Table-driven test: every event_missing item x every profile_missing item x both together x neither (a refusal naming no item falls back to a neutral sentence that does NOT blame the cover). One shared mapping, no second copy of the wording. Red first: show the new test fails on today's code.
4. The orchestrator walks it at 390x844; you report the exact test names. PR body labels: `Verified on real data:`, `- Shapes surveyed:`, `- Checks run:`, `NOT verified:`; Phone QA names 390x844.
5. COMMITS: separate plain commands: add the files, then commit with a message file, then one push of `claude/p3-status-real-reasons`. No `&&` chains, no `-c` flags. ONE push; the final subject ends with the done marker of your ticket and contains `[skip preview]` (Vercel cap).
