# Handover: fix-join-copy-r1

Done: (1) step total now constant at 3 (was a REAL inconsistency: joinProgress dropped to "of 2" once a complete profile signed in); (2) one `possessive()` helper in joinCopy.ts, join card reworded "events of <name>"; (3) email placeholder you@example.com + 2px foreground/60 border on bg-card, 16px text; (4) "Ask the person who sent it for a new link." under invalid/used/revoked/expired cards (DeadScreen and StopScreen refused). Tests: join/__tests__/joinCopyRoughEdges.test.tsx plus two updated expectations.

Not done: 390x844 light/dark browser walk (laptop-walk script is not on this worker), real-data shape survey, full CI-step run (only vitest on src/modules/admin-organisers, eslint on join/: 0 errors).
Next: owner walks the invite link at 390x844 light and dark; run `npm run pre-ship`.
