# BRIEF: ticketing design review r3 (admin issue #1433)
Branch: claude/review-ticketing-organisers-r3. Docs only, read-only on prod (SELECT only, no personal data). Never a write.
Read: docs/briefs/design-ticketing-organisers.md (DRAFT 3, on main), docs/review/ticketing-design-fixes-r1.md, and r1/r2 reviews on branches claude/review-ticketing-organisers and claude/review-ticketing-organisers-r2.
Task: check r2 items N1-N3 (and the r3 R3-* rows) against current prod and Website main. Return PASS or FAIL per shape: no steps, one step, many steps, past step, price_changed between view and reserve, course vs event, v1 vs v2 callers (owner click 2026-11-12).
Output: ONE PR comment on the review PR with the per-shape table, a Verified / Not verified block, and a one-line verdict (PASS = T-briefs may be written; FAIL = list what the design author must change). No review pack, no INVENTORY file beyond a short table.
Close G-1 (which reserve version the prod edge calls) if the admin repo is readable; otherwise say Not verified.
Do not touch #1434 and later. Owner decisions in section 1 of the design are not reopened.
