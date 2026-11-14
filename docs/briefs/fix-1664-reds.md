# Fix the 2 red checks on PR #1664 (branch claude/option-a-tickets-tab)

Lane: normal. Same branch, same PR, push once. No DB change.

Red 1, bundle-budget: `perf-budgets.json` entry "src/modules/dancer-app/dancer-app.tsx" is not in the client manifest. Find what the PR changed about how that chunk is entered, then update the budget row with a measured note (bare `npm run build` + `npm run check:bundle-budget` on Dell via dell-run), following the file's own rules. Do not loosen without a measurement.

Red 2, dancer-area-isolation (10 violations, rule a): changed files outside src/modules/dancer-app/ that are not tests/seams: docs/qa/option-a-tickets-tab/*.png (8 screenshots), scripts/check-e2e-spec-coverage.mjs, src/modules/tickets/TicketThanksPage.tsx, src/modules/tickets/useOrderStatus.ts. Read RULES at the top of scripts/check-dancer-area-isolation.mjs and briefs/dancer-rebuild-INTERFACE.md section 5. Preferred fix: move the screenshots into the PR description (screens only go in the PR) or an allowed path; keep tickets-module edits only if they are listed seams, else move the logic inside the dancer-app module. Fix the call site, never the check.

Owner words: lead decides technical gates (2026-11-13). Do not touch money logic.
