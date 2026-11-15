# Handover: live-qa-triage (dt_0988c304ee5a)

Done: classified run 43160779724 (3 failures, not 2); baselined the 4 `/event/50-50` page-check findings in `tests/e2e/live/baseline.json`; found why the schedule stopped.
Left: owner decisions below. Next: after the guest-list tap targets / disabled reason are fixed, remove those 5 baseline entries.

- Schedule stopped because `.github/workflows/live-qa.yml` has the `schedule:` cron commented out (owner click 2026-11-13).
- Organiser card + search show 11 Nov (past) as next date: real product bug, NOT fixed here; tests untouched so they keep failing for the real reason.
- Live site is blocked by the sandbox proxy: nothing re-run live.
