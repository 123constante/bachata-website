# Brief: "(no name)" wording on the Possible duplicates screens (Website, normal lane, one PR)

Branch: `claude/invite-noname-label`. Base: current `main`. No migration, no prod write, Supabase read-only.

## What the owner saw (live, phone, 2026-10-24 16:32Z)
/admin/organisers showed "7 possible duplicates". Two pairs read "... next to (no name), a profile you made."
A profile an admin made with no first name comes back from `check_invitee_duplicates_v1` with a label of the literal text
"(no name)" (premade_label / login_label / person_label). The sentence then reads like a bug. The same shape will recur.

## Files (read first)
`src/modules/admin-organisers/duplicates/`: `duplicatesModel.ts` (parseDuplicates, str()), `duplicatesCopy.ts`
(pairSentence, pausedSentence, sameLead, joined), `DuplicatesAlert.tsx`, `DuplicateReview.tsx`,
`__tests__/duplicates.matrix.test.tsx`, `tests/e2e-build/invite-who-duplicates.build.spec.ts`.

## Task
1. Survey the real label shapes read-only (Supabase MCP, counts only): which label strings can the RPC return for a profile
   with no first name (literal "(no name)", empty, null, whitespace)? State the list in the PR body.
2. Normalise in ONE place (the parser): any of those shapes becomes "no name yet" internally; copy renders it as
   "a profile with no name yet" (keep side: reword the sentence if needed so "... next to a profile with no name yet, a profile you made."
   reads naturally), and in `sameLead` / `joined` ("Joined. This profile has no name yet and is one profile now ..."). The fold
   (sign-up) side with no name reads "Someone who signed up". Never show the raw text "(no name)" or "Unnamed profile".
3. Rank pairs with a nameless side LAST in the list (stable order otherwise).
4. Table-driven test: every label shape x every sentence/screen (alert row, Same person?, What will change, Joined, paused join row),
   asserting no text contains "(no name)" or "Unnamed profile" and every sentence is grammatical. Red first.
5. Extend the build spec for the nameless pair; mocked 390x844 and 360x640 screenshots; mark them "mocked shape" in the PR.

## Gates / hand-off
Run every CI job step in your sandbox and put the per-job table in the PR body. PR body labels exactly as
`scripts/check-pr-real-data-verified.mjs` expects (`- Shapes surveyed:`, `- Sizes checked:`, `- Walked:`; colon directly after the label).
Design Gate: a wording fix needs stage 4 (self-running checks) and stage 6 (orchestrator walk); say so in the PR. Touch no other module.
Stop after the push and report.
