# Fix round 3: Website PR #1584 (organiser Events tab), branch claude/profile-dash-organiser-events-build
Independent review verdict FIX (PR comment on #1584; also branch claude/review-events-1584 docs/review/events-1584.md). Fix exactly F1-F4, nothing else; this is the last round (owner rule: one review round).
- F1 (must): src/modules/organiser/p3/events/DashEvents.tsx:33 `setKey` never called. Call `setKey(newIdempotencyKey())` in `reload()` (~:65) and in the non-network catch. Add a test in __tests__/dashEvents.test.tsx: after conflict -> Reload -> Confirm, the second runBulkCommand key differs from the first and carries the refetched expected_version (red first).
- F2: make the fake in tests/e2e/walk-p3-organiser-events.spec.ts bump the series version / change a night before Reload, then re-shoot organiser-events-walk-conflict-after-reload.png so it differs from every-night-confirm.
- F3: remove the second "Close" at DashEvents.tsx:82 (keep the Sheet's own).
- F4: DashEvents.tsx:201 default unknown role to view-only: role === 'owner' || role === 'manager' ? role : 'contributor'; add a test row.
Keep PR body labels valid; add the per-job CI table. Run vitest src/modules/organiser/p3/events, check:mojibake, tsc on touched files. Handover Verified / Not verified.
