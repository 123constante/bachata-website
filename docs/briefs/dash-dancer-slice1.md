# Brief: Dancer dashboard slice 1 (admin issue #1534), Website, normal lane, Sonnet
Branch: claude/dash-dancer-slice1. One slice = one branch = one push. No DB change, no migration.
Read first: ~/.claude arc contract is not available to you; the full contract is the comments on admin issue 123constante/bachata-admin#1534 and #1531 (gh issue view 1534 --comments). Quote them, do not guess.
Design: Option A, Website PR #1569 (branch claude/profile-dash-dancer-opts): docs/design/profile-dash/dancer-option-a.html + dancer.md + shot-a-*.png. Base tokens: docs/design/profile-dash/prototype.html.md on brief/profile-dash-opts. Dark theme, 390x844, core only.
Apply the 7 listed fixes on the issue (DESIGN PICKED comment) while building. Owner decision: D4 Claim button re-runs existing no-arg claim_my_dancer_profile_v1() and shows the returned status; draw/handle no_match, ambiguous, email_unproven, success. No DB change.
Journeys: D1 new stub, D2 unfinished, D3 complete (Nights attended = my_dancer_stats_v1.nights_went; empty = one CTA), D4 unclaimed. One-profile accounts: no Switch (button reads "Account").
Real data: wire to live data, no hardcoded names. Survey shapes read-only first (unclaimed by steps 0..4 = 20/26/46/62/45 of 199; claimed 14).
Done = UI PR docs/design/<pr>.md, table-driven tests screen x shape (untouched Save sends nothing; no copy pointing at a missing control), all CI steps run, 390x844 screenshots on the PR of: 3 roles, 1 role, new, unfinished, claimed, unclaimed. PR body: Verified / Not verified. Put per-job CI table in PR.
Do not touch organiser files (parallel worker on claude/dash-organiser-slice1). If a shared file must change, stop and say so in the handover.
