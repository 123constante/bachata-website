# Brief: dancer dashboard slice 1, build option B (queue-website#1534)
Lane: normal. Website only, NO migration, NO DB write. Behind a feature flag (default off).
FIRST read docs/design/dancer-dash-protos/INVENTORY.md (every field, state and option from the admin app, the current Website and the public page, file:line cited, GAPs listed) and option-b.html (owner picked B, 2026-11-12). End with a coverage count: items from INVENTORY.md built or deliberately left, each with a reason.
Build the smallest working version of option B: one focus card (profile step, else next night, else "find events"), then up to 3 rows: Finish your profile, next step, nights attended. Positive-only counts (show a count only above 0). Share disabled with a reason until the profile has its 4 required steps.
States: new, partial, complete, unclaimed, empty, loading, error; every one has an action.
Checks: contrast >=4.5, taps >=44px (explicit px), no sideways scroll, no raw unicode punctuation (use HTML entities in JSX). Table-driven tests screen x shape. Real-data shapes surveyed read-only (project stsdtacfauprzrdebmzg, counts only, no personal data).
Walk at 390x844 and put screenshots on the PR. PR body: Verified / Not verified block and the label lines the CI demands.
