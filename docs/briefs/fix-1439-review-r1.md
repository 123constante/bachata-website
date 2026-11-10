# Fix round: PR #1439 (door refused card) after independent review
Branch: claude/door-no-access-dead-end (existing PR #1439). Normal lane, Sonnet.
Review (read it first, fixes are listed there, section "PR #1439 / Fixes (ordered by severity)"):
`git show origin/claude/review-door-raffle-1439-1429:docs/review/review-door-raffle-1439-1429.md`
Do: apply every fix in that section (incl. fix 2: restore LF line endings on the file flipped to CRLF; and the copy that over-promises).
Merge current main into the branch first. Re-run the reviewer's listed test commands; all green. One push. Stopping rule: one fix round.
Owner words: reviews must catch these before the owner sees anything.
Verified / Not verified block in PR body.
