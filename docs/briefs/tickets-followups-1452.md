# Tickets screen follow-ups (#1452, child of #1450) - Website repo, normal lane

Repo: 123constante/bachata-website (cloud worker clones it). Display/copy only. Do NOT touch prices, refunds, payouts, fees logic, migrations, or supabase/**.

Contract: Manager x tickets screen x paid / part-refunded / free orders:
1. No pence figures shown anywhere on the screen (money shows as whole-currency formatting from one shared formatter; find where raw pence/minor units leak).
2. "Going" copy consistent across the screen (one string source; list every place it appears first).
3. A realistic contributor test: table-driven, screen x order shape (paid, part-refunded, free, empty, huge counts), using one shared mapping; red first.
4. Part-refunded orders carry a visible note saying so; no copy pointing at a missing control; empty states say what to do.

Process: survey the screen first (file:line list of every money and Going string), then fix. Follow the repo's guards and design rules (taps >=44px, contrast >=4.5, 390x844 no sideways scroll). One slice, one branch, one push. Put the CI job table, a Verified / Not verified block and 390x844 screenshots in the PR.
