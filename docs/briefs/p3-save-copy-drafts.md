# Brief: P3 save copy must not say "Dancers see it now" for a draft (normal lane, Sonnet, Website only, no DB)

Branch `claude/p3-save-copy-drafts`. Owner click 2026-11-02 (lower priority, not a stopper): the P3 save confirmations in `src/modules/organiser/p3/model/labels.ts` (lines ~217-220: savedEvery, savedDate, addedEvery, addedDate; ~270-271: detailsSaved, detailsSavedOne; also pricesSaved, and `saveWordsFor` in `model/saveWords.ts`) are static and say "Dancers see it now." even when the event is a draft. Walk evidence: draft 68d64855-b71e-4bef-9635-56357dd463dd on test org 5c3943c2, lifecycle_status draft after a name edit. Organisers must still be able to create and edit events; this is wording only.

Rule (decided by the program lead): live event -> unchanged wording. Draft -> replace the sentence "Dancers see it now." with "Saved as a draft. Dancers do not see it yet." (same lead-in where the line starts with "Saved for ..."/"Added to ...", e.g. "Saved for every date. Saved as a draft, dancers do not see it yet." choose the clearest, keep one sentence each).

Standing headers: prove the data source first: which field tells the screen the event is live or draft (read `useWorkspace`/the P3 event workspace and the RPC it reads, e.g. lifecycle_status; state which and who writes it; list ALL values it takes on prod with a read-only COUNT: draft/live/ended/cancelled/other) and what the screens should say for each value (ended, cancelled and unknown must not claim "Dancers see it now" either; say what you chose). Stopping rule: one independent review, one fix round.

## Do
1. One shared mapping: a function of the lifecycle value returning the save words; screens call it (never two copies). Callers: DetailsScreen.tsx, PricesScreen.tsx and every other user of the labels above (grep for each key).
2. RED FIRST, table-driven: every save message x {draft, live, ended, cancelled, unknown/null} x {one date, many dates}; assert no message says dancers see it now unless live. Update `claimEdit.matrix.test.tsx` lines ~91-92 for the new signature. Paste the red count from the unfixed code in the handover.
3. No change to when saves are allowed or what is sent. Untouched save still sends nothing.
4. Run lint, the p3 unit tests, tsc errors only in touched files, `npm run check:bundle-budget` (report numbers; the P3 area is flag-OFF, still report). Use HTML entities, never raw Unicode punctuation. PR body Verified / Not verified (walk is the orchestrator's).

Handover at `docs/handover/p3-save-copy-drafts.md`. Last commit subject ends with the done marker from your prompt.
