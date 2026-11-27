# Brief: Dell core loop (#1496, child of #1492), repo bachata-admin, careful lane
Build: GitHub-event trigger + 10-min sweep for the Dell machine, with lock file, STOP file, $50/day cap, dry-run mode.
Acceptance contract: Ricky x PC off x worker done / PR green event: Dell acts within seconds, sweep catches misses, exits on lock/STOP/budget, logs one line per pass.
Rules: dry-run is the default until tests prove each exit path (lock held, STOP present, budget hit). Table-driven tests per exit path + event shape. No secrets in repo. Money cap is a hard stop, not a warning. PR must include Verified / Not verified.
Issue: https://github.com/123constante/bachata-admin/issues/1496
