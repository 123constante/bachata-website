# Brief: Dancer dashboard slice 1 (admin issue #1534, normal lane, Website, NO DB change)
Branch: claude/profile-dash-dancer-slice1 (one slice = one branch = one push). Parent #1531.
Contract: ~/.claude/plans/profile-dashboards-contract.md (copy: docs/briefs/dash-contract.md on this branch if present; else read UPDATE 2026-11-12 below).

## Build
Dancer dashboard as design B (one step at a time, calm; dark) from docs/design/dancer-dashboard/option-b.html on PR #1561 branch claude/profile-dash-dancer-designs (read it, port it; do not redesign), plus the OWNER-PICKED top-right profile switch (sheet: Dancer / DJ / Organiser, "+ Add a profile").
Journeys: D1 stub/empty: Finish your profile + next step + preview, no stats. D2 partial: next missing step; Save untouched sends nothing. D3 complete/claimed: checklist hidden; Nights attended = my_dancer_stats_v1.nights_went; empty = suggested action. D4 unclaimed match: Claim your page button.
## Decisions from owner (2026-11-12)
- Going / Nights attended near-empty on prod: explicit empty states, never headline tiles.
- Claim button needs server support (today auto-claim): do NOT add DB/RPC. Render the Claim control only if a client-side path exists; otherwise note it as follow-up in the PR (admin issue) and keep D4 copy truthful, no control pointing at a missing action.
- Partner tile / lineup / rate-a-level nudge move to Nights, not this screen.
- No page-view tiles, charts, enquiries, saves, weekly summary.
## Done means
Table-driven tests screen x shape (stub, partial, complete, unclaimed) with one shared mapping; empty states say what to do; disabled controls say why. Design record docs/design/<pr>.md. Checks: contrast >=4.5, taps >=44px, no clipping/sideways scroll at 390x844. Screenshots in PR; per-job CI table in PR. Survey real prod shapes read-only first (report: branch claude/profile-dash-survey docs/briefs/dash-survey.report.md). Verified / Not verified block in handover.
