# Handover: welcome-w1b-join-note

Done: onboarding Ask-to-join sheet requires a note of REQUEST_NOTE_MIN (3) chars, reuses the public card's constant and reason wording; send disabled with aria-describedby on the reason; `request()` guarded too. Label no longer says "(optional)". 500-char limit kept.
Tests: new `OrganiserSheet.note.test.tsx` (7 table cases; 7 red on old source, green now). Changed: `dancerFirst.refusal.test.tsx` and `ClaimStates.test.tsx` (both sent an empty note, the old optional rule; now they type a note, ClaimStates also asserts disabled first).
Prod (read-only, project stsdtacfauprzrdebmzg, `entity_decision_audit` action=access_requested): 8 requests, 6 with an empty note, 0 of 1-2 chars. `request_organiser_access_v1` accepts an empty note (p_message DEFAULT NULL; only too_long/invalid refused): PARKED W2 server item, no migration here.
Checks: vitest src/modules/organiser/home + dancerFirst: 385 pass; npm run lint: 34/34 green; check:mojibake clean; tsc: 0 errors in touched files (run on branch head before commit).
Not verified: npm run pre-ship, 390x844 browser walk/screenshots (empty, 2, 3 chars, server error), per-job CI table (no PR opened; none asked for in this run).
