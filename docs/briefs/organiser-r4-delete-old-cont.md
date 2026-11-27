# Continuation: organiser R4 delete old P3 + V2 screens

Branch `r4-delete-old` already holds the first worker's commit (code deletion done). Read `docs/handover/organiser-r4-delete-old.md` on the branch: its "Left (next steps)" list is YOUR task, items 1-6, in order. Original brief: `docs/briefs/organiser-r4-delete-old.md` on `brief/r4-delete-old`.

Goal: R4 is the only organiser UI; flags `organiserShellV2` and `organiserR4` gone; unit, e2e, bundle budget, mojibake, integrity, pre-ship and lint green; open ONE PR.

Rules for this slice:
- Product is decided: no new UI, no behaviour change. Raffle stays out. "Message everyone" and Reminders row stay out.
- Before blaming your change for a red unit file (contract tests), check the same test on origin/main.
- Delete tests that only covered deleted screens; do not weaken tests for kept R4 screens.
- Open the PR with the `## Verified on real data` and `## Phone QA` blocks (real data: WALK org f2f93490-7b26-4eed-a69d-82b6ca50404e is already walked by the owner's session; say "not verified here" if you cannot run it).
- If you run low on context, push and update the handover with the remaining list, mark PARTIAL.
