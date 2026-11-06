# BRIEF: automerge-label-last-add (Website; careful lane; Opus; hard-tier files)

Brief-version: 2

Source: arc file docs/arcs/automation.md, "Slices not yet briefed" row "Follow-ups from the auto-merge review", and docs/handovers/automerge-web-classes-abc.md ("Follow-up: reviewLabelRefusal should require the LAST review-passed add to be the bot's").

`reviewLabelRefusal()` passes when ANY `review-passed` label add is by the bot. A person can add the label after the bot, then the bot's earlier add still counts. The rule must read the LAST add.

## What main lacks
- extends: `reviewLabelRefusal(labels, labelEvents, anchor)` judges the LAST `labeled` event for `review-passed`: its actor must be BOT_LOGIN and its time after the push anchor; an earlier bot add followed by a later human add is refused with a named reason -- scripts/lib/autopilot-merge.mjs
- tests: table of label-event sequences (bot only after anchor; bot then human; human then bot; bot before anchor then human; no events; events not an array; unlabeled in between) x verdict, red first on main -- grep: reviewLabelRefusal in tests/autopilotMerge.test.ts (currently only a mutant comment, no direct table)

## Files
- scripts/lib/autopilot-merge.mjs
- tests/autopilotMerge.test.ts
- docs/handover/automerge-label-last-add.md

## What to build
1. Red first: add the table cells, run on main, keep the red output in the handover.
2. Change only `reviewLabelRefusal`; keep fail-closed behaviour and existing refusal strings that tests already pin. An `unlabeled` event after the last add means the label is not present (labels list already covers it); do not loosen anything.
3. Both callers (merge lane `mergeVerdict` and class C in scripts/automerge-classify.mjs) share the function; do not edit the classifier file.
4. Run: `npm run lint`, `vitest run tests/autopilotMerge.test.ts tests/automergeClassify.test.ts`, the classifier `--self-test` canary from its header, `npm run check:mojibake`, `npm run check:integrity`.
5. Do not touch .github/workflows. PR body: real-data lines (shapes = the table) and a bare `## Phone QA` heading "no UI path changed". Hard-tier: the owner Approves at head.
6. Push once; last commit subject ends `[worker-done <ticket>]`.
