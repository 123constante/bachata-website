# Brief: seo-preview red on #1543 (Event JSON-LD missing)
Branch: fix/gateretry-matrix-flake (PR #1543). Lane: normal. No DB change, Supabase read-only.
Failure (run 43062878613, job seo-preview, step "Run SEO guard (preview)"):
  [FAIL] /event/rogue-bachata and /event/rogue-bachata-wednesday: "no Event JSON-LD node".
Not red on main's guard because main has not previewed these pages; data came in via #1478.
Task: 1) read-only, find why the event page emits no Event JSON-LD for these two slugs (missing field in the event row? renderer skips on null startDate/location?).
2) Fix the class: the renderer must emit a valid Event node whenever the page renders, degrading missing optional fields; add a table-driven test over event shapes (full, no end, no venue, no image, past, recurring), red first.
3) Run the seo guard locally against the preview if possible; push; PR table of CI jobs. Do not touch the gateRetry test change.
Done marker: PARTIAL/DONE [worker-done seo-event-jsonld] in the handover commit.
