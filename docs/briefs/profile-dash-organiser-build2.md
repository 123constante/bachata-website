# Brief: Organiser dashboard slice 1 (admin issue #1535), Website, normal lane, Sonnet
Branch: claude/profile-dash-organiser-build2. One slice = one branch = one push. No DB change, no migration.
Contract: INLINED BELOW (this cloud session cannot read bachata-admin issues and gh is unavailable; do not try). Build from the text below and the design files on Website branch claude/profile-dash-organiser-opts (PR 1570).
Design: Option A + B's date rail for the night list, Website PR #1570 (branch claude/profile-dash-organiser-opts): docs/design/profile-dash/organiser-option-a.html, organiser-option-b.html, organiser.md (inventory + GAPs), shot-*.png. Base: prototype.html.md on brief/profile-dash-opts. Light theme, 390x844, core only.
Apply the 9 listed fixes on the issue (DESIGN PICKED comment).
Data (survey #1532, report on Website branch claude/profile-dash-survey docs/briefs/dash-survey.report.md): Going from event_attendance (near-empty: explicit empty state, not headline); opens from event_views (every open, per session-day; NO source split in this slice); link clicks by link_type from event_link_clicks; organiser-page opens from profile_view_events (organiser card on event page); city average only when 5+ organisers in city (1 of 319 cities qualifies); Tickets tile only when selling via us (1 organiser). Positive-only: zero = suggested action. Where a GAP has no data source, omit the tile, do not fake it.
Shapes to draw and test: new, upcoming, zero, huge (up to 222 upcoming dates; cap the list), cancelled (live nights only), selling, loading, error, contributor seat (view-only Team/Add disabled with reason).
Done = docs/design/<pr>.md, table-driven tests screen x shape, all CI steps run, 390x844 screenshots on the PR of every shape above. PR body: Verified / Not verified; per-job CI table.
Do not touch dancer files (parallel worker on claude/profile-dash-dancer-slice1). If a shared file must change, stop and say so in the handover.

## Contract (inlined from admin 1535 / 1531)
Acceptance contract: Organiser (light) x next action, share, per-night stats x no events, upcoming nights, selling via us; positive-only, zero = suggested action; walk 390x844.
DESIGN PICKED (owner 2026-11-12): Organiser Option A + B's date list. Build core only (light theme, 390x844). Use B's date rail for the night list under the hero.
Fixes to apply:
1. City-average footer only when 5+ organisers in the city; otherwise draw nothing.
2. Contributor seat: hide or disable Profile "Add" and "Add a teammate" with a one-line reason.
3. Cancelled night: count live nights only; copy must not claim people were told; collapse after "Tell your group"; hero becomes next live night.
4. Profile row: separate label and sentence fields (no lowercased step names, no "Add" for every step).
5. No fictional bc.link domain; use the real page link or mark placeholder.
6. Hero for a healthy night carries its headline number (e.g. "12 going, 248 opens") + share button.
7. Zero shape: no duplicate message between hero and first night card.
8. Tickets tile only when selling, folded into the "N nights coming up" row (not a separate card in first screen).
9. Remove dead "Your nights: None yet" row; remove unlabelled "See" button; drop "YOUR NEXT STEP" kicker.
Acceptance: 390x844 walk of new, upcoming, zero, huge, cancelled, selling, loading, error, contributor.
Previous attempt (dt_2e6370c69a6b) stopped only because of the unreadable contract. Where organiser.md GAPs say a read does not exist, omit that tile (no DB change); list omitted tiles in the handover.
