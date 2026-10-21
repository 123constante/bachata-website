# ER-C13 (admin-ui, repo `123constante/bachata-admin`): rules mirror and admin editor parity

Branch `claude/er-c13-admin-rules` from admin `main`. After ER-C3 (the JSON is pinned there). Plan rules 2, 3, 9, 13. Read ER-COMMON (Supabase READ-ONLY; admin CI bills: push ONCE).

1. `lib/event-rules.json`: byte-identical copy of the Website `src/modules/organiser/shared/event-rules.json` (fetch the Website branch `claude/er-s1-rules` with plain git). `lib/eventRules.ts` thin reader; the admin editor reads blockers/lesson lengths/cancel reasons from it where it already enforces the same rule (do not change behaviour: add tests that pin parity with `lib/cancellationReasons.ts` and `deriveSpanFromProgramTree`).
2. A compare script + npm script (`check:event-rules-mirror`) against the Website copy; mutation proof (change one byte -> red). Workflow wiring: "needs owner: workflow step" in the PR body.
3. Admin editor-v2: require a session at create; the "How to pay" choices IF the admin save already accepts `payment_methods`; check first. It does not until ER-AD1 lands: if not, stop that part, push the rest, say so in the PR.
4. Read-only report (script, counts only, no personal data): series where `default_local_start_time` != MIN(session start), and classes stored with lengths 540-1260 min. Output to the PR body. No data change.

Touches: `lib/eventRules.ts`, `lib/event-rules.json`, `lib/__tests__/eventRules*`, `components/events/editor-v2/save/buildSeriesPayload.ts`, `scripts/check-event-rules-mirror.mjs`, `scripts/report-series-time-drift.mjs`.
