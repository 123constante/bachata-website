# Brief: Event JSON-LD missing on /event/rogue-bachata and /event/rogue-bachata-wednesday
Lane: careful (public routes, SEO). Repo 123constante/bachata-website. Branch: fix/seo-event-jsonld-rogue.

## Failure
SEO Guard (seo-check on main AND seo-preview on PRs) is red on main for 5+ runs (latest main run 43010567250; PR #1543 run 43040124416):
`[FAIL] /event/rogue-bachata-wednesday` and `[FAIL] /event/rogue-bachata`: "no Event JSON-LD node". Other event pages (bailando-sundays, ritmo-de-bachata-festival) pass. Data came in with #1478.

## Task
1. Diagnose read-only: why do these two slugs render without Event JSON-LD (missing field in the data shape, e.g. no start date / venue / recurrence, vs the builder's guard)? Survey prod event shapes (status x type x counts x empty x past x huge) read-only via Supabase.
2. Fix the CLASS: any event shape the page can render must emit valid Event JSON-LD, or the guard must assert only what the data can honestly supply. Do not weaken the guard to hide a real gap; do not invent data.
3. Table-driven tests: shape x page, red first. Add a check that catches this class before merge.
4. Verify against the preview: all 4 asserted event pages [ok], SEO Guard green.
## Done
PR (bot-authored) with per-job CI table, Verified / Not verified block. No merge, no prod writes.
