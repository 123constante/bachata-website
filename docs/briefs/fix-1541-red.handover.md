# Handover: fix-1541-red (dt_c09b502c9a4b)

Branch merged with origin/main (clean, no conflicts). Full `TZ=Europe/London vitest run`: 16 failed / 29979 passed, in 5 files, none touching ticket/money_visible code:
- eventViewCompat / occurrenceProgram / publicEventPageLineup `.contract.test.ts`: live-DB tests, "Invalid API key" (no Supabase secrets in this sandbox).
- integrityCouldNotRun.test.ts: "typescript resolved in the temp repo -- precondition gone" (sandbox node_modules layout).
Could NOT reproduce the CI red for `unit (Europe/London, full)` here; no code change made. Next step: read the failing CI job log (get_job_logs) to see the actual failing test.
Typecheck: 128 errors in unrelated files (baseline 106 in pre-ship.mjs); mojibake clean. pre-ship not run; no PR body edited.
