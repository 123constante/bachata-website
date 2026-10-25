# Handover: "(no name)" wording on Possible duplicates (dt_00646d65e6ce)

Done: parser normalises every no-name label shape to null (`labelOf`, duplicatesModel.ts); copy renders
"a profile with no name yet" / "Someone who signed up" / "Joined. This profile has no name yet ..."; server
change lines have a quoted "(no name)" reworded; pairs with a nameless side sort last. Table-driven vitest
(5 label shapes x 3 sides x every screen) + build spec case; mocked screenshots in docs/screenshots/invite-noname-label/.
Left: orchestrator walk (Design Gate stage 6). Nothing else.
Note: `check:integrity` fails with exit 126 (bin/check-integrity.sh not executable) in the sandbox, on clean main too.
