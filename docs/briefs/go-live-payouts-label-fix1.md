# Brief: PR #2509 fix1 - v2 Go live bar fallback link for ticket_payouts
Brief-version: 1
Branch: claude/go-live-payouts-label
Lane: normal, Sonnet. Repo 123constante/bachata-website. Fix round on the EXISTING PR #2509 (same branch, push on top; do not open a new PR).
Size: 3 files, 80 lines. No new design: same link fix as the rest of #2509.

## Read the brief
Never run `gh api`. Read this file with `git fetch origin brief/go-live-payouts-label && git show FETCH_HEAD:docs/briefs/go-live-payouts-label-fix1.md`. The original brief is docs/briefs/go-live-payouts-label.md on the same branch.

## Review findings to fix (independent review r1)
1. MED `src/modules/organiser/p3/v2/GoLiveBar.tsx:46`: FixLine's fallback calls `goLiveFixHref(section, seriesId)` with no code. When VITE_ENABLE_GOLIVE_FIX is off or `onFix` returns false, a `ticket_payouts` row opens the ticket-link editor (the wrong screen the brief forbids). Fix: pass `first.code` into FixLine and on to goLiveFixHref (same code-aware call the other callers now use). Add a test: GoLiveBar fallback for ticket_payouts links to Get paid; ticket_link still links to the ticket-link editor. Run the new test against the current branch head first (it must fail) and say so.
2. LOW PR body Inventory: it says no caller has an organiser id, but `goLiveGaps` takes `organiserId` (the workspace page, not the money owner `ticket_types.organiser_id`). Reword: why getPaid is built without `?o=` (workspace page may not be the money owner), and list it under Not verified: accounts with more than one organiser page may land on a different page.
3. LOW PR body Verified: add GoLiveBar to the inventory; add a read-only prod shape survey (counts only): live/draft series that have a paid ticket type (price_pence > 0 or early_price_pence > 0) in draft/on_sale whose organiser has no charges_enabled organiser_stripe_accounts row, by lifecycle_status.
4. event-rules.json mirror: admin PR (branch claude/event-rules-ticket-payouts) adds the identical line; do not change event-rules.json further. Note in the PR body: "Merge after admin claude/event-rules-ticket-payouts".

## Do NOT touch
Calendar files, dialog.tsx, supabase/**, workflows, scripts/**, .env*, event-rules.json.

## Done when
One push; PR body updated; tests green; last commit subject ends with the [worker-done ...] marker.
