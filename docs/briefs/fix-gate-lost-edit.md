# Brief: fix-gate-lost-edit (normal lane, Opus, Website only, no DB change)

Branch: claude/fix-gate-lost-edit. Lead: website-98. Owner click 2026-11-04 (via website-5f): fix FIRST the lost edit after the gate; return the person to their event afterwards.

## Failure (owner-facing, from walk docs/walk/invite-recheck/RESULTS.md on branch claude/walk-invite-recheck-1, pictures on/22-gate-10-left.png and on/23-after-continue-10-left.png)
Organiser opens an event, Repeat sheet, fills it, taps Save. Server refuses (onboarding_incomplete). Sheet "A few details first" (10 rows, Continue / Not now). Continue goes to the checklist: "10 things left", ONE row + "Show all", footer "Go to Home". The Repeat edit is gone and there is no way back to the event (back link only shows when nothing is left, see returnTo.ts finishLabel).

## Do
1. Red first: a table-driven test for the refused-write -> gate -> Continue -> checklist path, for every gate left-count (10, 6, 3, 2, 1) x every refused screen (event page, Repeat sheet, Details, Prices, Dates) x back valid/invalid. It must fail on current main.
2. Return path: while the checklist has items left AND a valid back event exists, show a secondary "Back to your event" (and keep "Go to Home" only when no valid event). When nothing is left, the primary stays "Back to your event". Same wording as returnTo.ts BACK_TO_EVENT. Tap target >= 44px, explicit px (site html is ~13.5px on phones).
3. Keep the edit: when the gate opens from a refused write, stash the unsaved Repeat/Details/Prices/Dates draft for THAT event only (sessionStorage, key by event id, expire on tab close or after 60 min, never sent anywhere). When the person lands back on the event and the stash exists, reopen the same sheet pre-filled and say once, in one plain line, "We kept your changes" with the Save button ready. Never auto-save, never replay a write silently (returnTo.ts says the refused edit is never replayed: keep that, the person taps Save again). If a screen's draft cannot be stashed cheaply, say which in the PR body and still do item 2 for it.
4. Do not touch: the gate rules, onboarding server rules (all 10 items stay required), copy of other gaps (they are queued separately), calendar protected files, supabase/**.
5. Flags: stays behind organiserP3 exactly as today. No new flag.

## Verify (Definition of done)
- Shapes: read-only survey is NOT needed (no data read); say so. Use the 10/6/3/2/1 left mixes plus a person with 0 left (gate never opens).
- Walk at 390x844 with the harness from tests/e2e/walk-invite-recheck.spec.ts (wait for heading and finished animations, resize to full page height). Take pictures of: gate sheet, checklist with Back to your event, event with "We kept your changes" and the Repeat sheet pre-filled. OPEN every picture yourself; identical byte sizes mean blank copies. Commit pictures to docs/walk/fix-gate-lost-edit/.
- Run every CI job step that applies (read .github/workflows), check:bundle-budget, test:unit for src/modules/organiser/p3.
- PR body: run pr-body.mjs equivalent: "- Shapes surveyed:", "- Checks run:", "- NOT verified:" (real phone, real server refusal: the walk mocks the refusal), Phone QA at 390x844.
- Handover doc docs/handover/fix-gate-lost-edit.md. Final commit subject ends with the worker-done marker given in the dispatch prompt.
