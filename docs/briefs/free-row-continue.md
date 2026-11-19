# Brief: free row picker, CONTINUATION (same branch claude/free-row, PR #1809)

Read docs/briefs/free-row-picker.md and docs/briefs/free-row-picker-handover.md first (git fetch origin claude/free-row; they are on the branch).

Code is done (commit 105970e1a). What is left, in order:
1. `npm run lint` and `npm run pre-ship` on the branch head; fix reds in the same PR.
2. Production shape survey (read-only, project stsdtacfauprzrdebmzg, counts only, no personal data, never a write): how many nights have a ticket type with price 0, how many nights mix free + paid, include lists over the 100-row API cap.
3. 390x844 walk on the Vercel preview: night with one free + one paid type; free-only night. Screenshots go in the PR.
4. Fill the PR #1809 body: "Verified on real data" and "Phone QA" blocks, preview URL. Run both body checks until exit 0.
5. Final commit subject ends `[worker-done dt_5ff37ab449e8]`-style marker of the NEW ticket; push claude/free-row.

Do not widen scope: no organiser switch, no rate limit, no renames.
