# Brief: Dancer dashboard design polish (admin #1537, normal lane, Opus, DOCS/DESIGN ONLY, no app code)
Branch: claude/profile-dash-design-polish. Parent #1531.
Task: refine owner-picked option B (one step at a time, calm, dark) plus the top-right profile switch (sheet: Dancer / DJ / Organiser, "+ Add a profile").
Base: docs/design/dancer-dashboard/option-b.html on branch claude/profile-dash-dancer-designs (PR #1561). Switch mock: docs/briefs/dash-switch-mock.md on this brief branch (copy of the owner-picked mock).
Contract journeys: D1 stub/empty (Finish your profile + next step, no stats); D2 partial (next missing step; Save untouched sends nothing); D3 complete/claimed (checklist hidden; Nights attended; empty = suggested action); D4 unclaimed match (Claim your page). Going and Nights attended are near-empty on prod: explicit empty states, not headline tiles.
## Produce (docs/design/dancer-dashboard/ only)
- polished option-b HTML (390x844) covering shapes: new, partial, complete, completeEmpty, unclaimed (Claim button copy must not point at a missing control: claim needs server support, show it as a clearly labelled state).
- design record docs/design/dancer-dashboard/polish.md: tokens, decisions, alternatives rejected.
- Checks listed in the record with results: taps >=44px, contrast >=4.5, no clipping or sideways scroll at 390x844, every empty/disabled state says what to do. Screenshots at 390x844 per shape pushed under docs/design/dancer-dashboard/shots/.
- Handover with Verified / Not verified. profile-dash then runs the Opus critique; no app code, no DB.
## INVENTORY first (before drawing anything)
Write docs/design/dancer-dashboard/INVENTORY.md BEFORE drawing: every field, state and option of the dancer profile from the admin app, the current Website dashboard and the public dancer page, each cited file:line, GAPs listed. End the polished design with a coverage count (inventory items covered / total, each uncovered one justified).
