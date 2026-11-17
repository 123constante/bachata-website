# Review round 3: PR #1752 (ci-speed) at head cee1fed17, hard tier (.github/, scripts/)
Branch for your report: claude/review-1752c (docs only, doc `docs/review/review-1752c.md`, a line `## Verdict:` and a last line `## Hard-tier: PASS` or `## Hard-tier: BLOCK`). Review only; do not push to claude/ci-speed.
Round 2 (docs/review/review-1752b.md on origin/claude/review-1752b) BLOCKed ce2a99df5: guard red on the real file (job `wallclock-budget` has no changes step, rule S1) and mutant d survived (a `#` comment containing the SKIP_IF text matched). Delta: `git diff ce2a99df5 cee1fed17` (one file, scripts/check-phone-qa-skip.mjs: EXEMPT_JOBS=wallclock-budget, SKIP_IF match ignores `#` comments).
Check with evidence (run the commands):
1. `node scripts/check-phone-qa-skip.mjs` passes on the real file; `--self-test` passes.
2. The exemption is narrow: only `wallclock-budget`, and a heavy step added to it still fails or is justified. Mutant d (SKIP_IF text only in a comment) now fails the guard. Name any surviving mutant.
3. No other change since round 2; round-2 items 1 and 3 still hold.
Report under 30 lines. State which CI checks were green at the head (`gh pr checks 1752`); phone-qa (1-3) may still be running.
