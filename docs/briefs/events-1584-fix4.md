# Fix round 4 for PR #1584 (branch claude/profile-dash-organiser-events-build): one defect, nothing else
Review r2 verdict FIX, defect D1: `docs/design/profile-dash/shots/organiser-events-walk-conflict.png` is stale (shows two Close controls; fix round 3 removed the duplicate at src/modules/organiser/p3/events/DashEvents.tsx:79-86 but did not re-take this shot).
Do:
1. Re-run the conflict step of tests/e2e/walk-p3-organiser-events.spec.ts at 390x844 and overwrite organiser-events-walk-conflict.png; confirm by eye (Read the PNG) it shows ONE Close.
2. Add a test that the conflict Sheet has exactly one Close: `getAllByRole('button', { name: 'Close' }).length === 1` in src/modules/organiser/p3/events/__tests__/dashEvents.test.tsx. Red first: temporarily re-add the duplicate button, see it fail, remove it.
3. Touch nothing else. Append "Fix round 4" lines (done / Not verified) to docs/briefs/profile-dash-organiser-events-build.handover.md. npm run check:mojibake; vitest src/modules/organiser/p3/events green; tsc zero errors in touched files. Push once; commit subject ends with [worker-done <ticket>].
