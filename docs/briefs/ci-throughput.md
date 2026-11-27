# Brief: CI throughput (#1500, child of #1492), repo bachata-admin, careful lane
Phase 1: measure runner-minutes, wasted runs, queue wait (median before) over >=20 real PRs; commit the numbers.
Phase 2 (only after phase 1 numbers are in the PR): cancel-superseded-runs via concurrency groups; path filters WITH pass-through so required checks still report green; shared cache; cheap-checks-first.
No new runner capacity (owner click 2026-11-11). Required checks must never go missing: prove with a docs-only and a code PR shape.
Issue: https://github.com/123constante/bachata-admin/issues/1500
