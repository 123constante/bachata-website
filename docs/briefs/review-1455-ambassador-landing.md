# Brief: independent review of Website PR #1455 (Bristol ambassador /join/a/:code landing), READ-ONLY review
Brief-version: 2

Branch: `claude/review-1455-ambassador-landing` (new, one review report file only; never push to claude/bristol-ambassador-landing). Lane: careful. Model: opus.

## What main lacks
- an independent review of a new public route that calls the admin ambassador RPCs -- grep: review-1455-ambassador-landing

## Scope
Review PR #1455 (branch claude/bristol-ambassador-landing, head 3e1bf99f; `git fetch origin claude/bristol-ambassador-landing`, diff against origin/main). Files: src/modules/ambassador/link/*, src/components/AnimatedRoutes.tsx, src/components/catchallClientPaths.ts, src/lib/breadcrumbs/siteIa.ts, src/integrations/supabase/types.ts, docs/design and docs/handover for the page. Admin side already applied (admin #1277: ambassador shared-link RPCs, `admin_locked`, counts only).

Questions, each answered with file:line evidence:
1. Public route safety: what can an anonymous visitor see or do at /join/a/:code? Does any state show a joiner name or another person's data? Does a wrong, expired, switched-off or admin_locked code show a safe not-found, never an error that leaks existence details?
2. Join tap: which RPC does it call, with which args? Is it idempotent (second tap = already joined), blocked for the link owner (own-link state), and does it handle signed-out, no-profile and RPC-error paths without a dead end?
3. Routing: `/join/a/:code` is registered in AnimatedRoutes AND catchallClientPaths; any conflict with existing routes, SEO guard, sitemap, or the breadcrumbs rule (buildBreadcrumbs)?
4. types.ts: is the change only the generated RPC types the page needs? Any hand-edit?
5. Design record: do the 12 screenshots cover every state the code can render; any state in code without a picture?
6. Tests: do they assert behaviour (state per RPC result) rather than snapshots only? Name 3 mutants (drop the own-link guard, drop the already-joined branch, show the name when absent) and say whether a test would catch each.
7. Anything that adds a request to the normal app shell load or a bundle-size jump.

## Files
- docs/review/review-1455-ambassador-landing.md (new)

## Do
Write docs/review/review-1455-ambassador-landing.md: verdict (SAFE TO MERGE / SAFE AFTER FIXES / NOT SAFE), findings ranked with evidence, PROVEN vs SUSPECTED, exact minimum fixes. Push once; commit subject ends `[worker-done <ticket>]`. Change no code. Do not add labels.

## Done
Report: verdict line, finding count by severity.
