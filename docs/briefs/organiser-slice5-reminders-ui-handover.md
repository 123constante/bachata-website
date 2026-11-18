# Organiser slice 5 reminders — Website UI handover

Done: `p3/reminder/` (model, api, `NightReminderRow`), wired into `OneDateSheet` list step (hidden on a cancelled night; the model still maps it). Reads `organiser_night_reminder_get_v1`, writes `_set_v1` (live on prod, applied 20270323080000). Switch is optimistic with rollback; a disabled switch always shows why; no command is sent unless the switch is used.
Tests: 16-case model matrix + 3 render tests (19 pass). tsc: 0 errors. check:mojibake clean.
Left: 390x844 browser walk on prod-shaped data (not done); `npm run pre-ship`; PR 1 hard-tier review/edge-fn deploy status was not checked by this worker.
Prod shape (counts only): 3369 nights, 154 cancelled, 0 settings rows, 0 log rows (all nights default ON, nothing sent yet).
tsc run on branch head: 0 errors in branch files.
