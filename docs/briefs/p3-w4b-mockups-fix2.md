# Brief: P3 W4b mockups fix round 2 (owner picks, wording)
Branch: claude/p3-w4b-mockups (PR #1114). Docs/mockups only; NO src/. One fix round, then stop.

Owner picks (2026-10-28): new account = option A (search first). Unfinished profile = option B (check at the tap).
Owner rule: a person with an unfinished profile is TAKEN to Finish profile by a button. Never "Message us" for that.

Do:
1. In no-city-A.html and no-city-B.html, find the line "Your account does not have a dancer profile yet. Message us and we'll set one up for you." It is today's copy for an account with NO dancer row (NO_PROFILE_TEXT in src/lib/profileCompletion.ts). Keep it ONLY in one separate, clearly labelled frame "Account has no dancer row (2 of 42 prod accounts, rare)". Mark that frame "to be replaced when Finish profile can create the row (server change queued)".
2. The normal unfinished-profile frames (missing city and/or photo, row exists) must show a primary button "Finish your profile" going to Finish profile, with the missing items named. No "Message us" in those frames.
3. new-account: mark A as chosen in the doc and gallery wording; keep B visible as "not chosen".
4. Update docs/design/p3-w4b-mockups.md section 2/3/7: record picks, the 2-of-42 count, and the rare-frame label. Re-run selfcheck.cjs; all frames pass (contrast>=4.5, taps>=44, no cut, width 390); keep the mutation test.
5. PR body keeps the literal "- Shapes surveyed:", "- Checks run:", "- NOT verified:" lines and "## Phone QA".
Context cap 35%. Push early checkpoint. Write handover in the PR.
