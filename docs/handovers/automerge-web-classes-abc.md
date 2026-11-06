# Handover: automerge classifier = classes A, B, C (dt_1c92d589256d)

Brief: `docs/briefs/automerge-web-classes-abc.md` on branch `brief/automerge-web-classes-abc` (v2).
PR: #1416 (`claude/automerge-web-classes-abc`). HARD TIER: owner Approve at the final head, then owner merge.

## Done
- `scripts/automerge-classify.mjs`: `isClassAB`, `isClassCTestPath`, `classOf`, `MAX_CHANGED_FILES` (60),
  `MAX_CLASS_C_LINES` (200), `reviewRecordVerdict` (class C record, fail closed), `BOT_ONLY_AUTHOR`,
  `pushAnchorFrom` / `readReviewRecord` (REST, read only when a class-C file is present).
- `scripts/lib/autopilot-merge.mjs`: `reviewLabelRefusal()` extracted from `mergeVerdict` (same reasons) and shared.
- `tests/automergeClassify.test.ts`: the A/B/C table, hard-tier rows (alone / in a docs PR / in a test PR), and the reader tests.
- `tests/autopilotMerge.test.ts`: one mutant string re-pointed at the extracted helper.
- `docs/automerge.md`: the three classes, the review-record rule, bot-only identity.
- RED-first (40 failed on unchanged code) and mutation output are in the PR body.

## Left / next steps (owner)
- Nothing on Website posts `review-pack:` comments or adds `review-passed` yet, so class C cannot qualify
  until that pipeline exists (fails closed).
- Owner decision: the record is posted by the same bot account that authors the PR, so it can be self-attested.
- Follow-up: `reviewLabelRefusal` should require the LAST `review-passed` add to be the bot's (lane and class C).
- `bot-automerge.yml` header comment is stale (the workflow was out of scope).
