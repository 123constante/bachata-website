# Handover: live-now-lag-r1

**Done:** `docs/design/live-now-lag/INVENTORY.md` (25 surfaces, gaps G1-G6),
`docs/design/live-now-lag/PLAN.md` (measurement, root cause, options A/B/C,
Live-now check, recommendation C + check, acceptance matrix). Docs only.

**Measured:** Bailando cancel save 19:19:39.003 UTC &rarr; `/api/revalidate` 200
at 19:19:39.036 (33 ms). Read-only SELECTs on `net._http_response`,
`event_series_p5`, `event_occurrence_p5`, `event_occurrence_override_p5`.

**Not done / blocked:** header timing on prod (`age`, `x-vercel-cache`,
`cf-cache-status`) &mdash; the worker proxy returns 403 for
www.bachatacalendar.co.uk and api.vercel.com. Only one save-to-purge pair
exists inside pg_net's ~6 h retention.

**Next steps:** (1) run the 30 s header probe from an allowed network against a
TEST event; (2) independent review of PLAN.md; (3) admin repo: `stateChange`
in the emit payload, venue + organiser emits; (4) this repo: hard-delete on
state change, warm `.data`, Done-screen Live-now poll.
