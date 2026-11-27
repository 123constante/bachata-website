# bot-pr-adopt fix1 handover
Done: TARGETS entry for scripts/lib/bot-pr-adopt.mjs; F1 (multiple open PRs -> warn+skip), F2 (old labels in error text), F3 (case-insensitive owner), F7 (adopt.out guard); tests for F1, F3, F2.
Verified: vitest entryPointCoverage + botPrAdopt 27 pass; prove-entry-point-dispatch PASS; tsc: 0 errors in branch files.
Not verified: CI on GitHub; open-pr job red is expected until merge.
