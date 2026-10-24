# People arc S8 continuation: make `dancer-area-isolation` green on PR #1012 (docs move only)

Repo 123constante/bachata-website. Branch claude/people-instagram-label (PR #1012, head b6b3ddc7). You are a FRESH continuation worker and the only one on the branch. Builder brief: briefs/PEOPLE-S8-instagram-label-brief.md on brief/people-arc. NO source change.

## The defect (owner rule: fix the class)
CI job `dancer-area-isolation` is red on #1012 with exactly one violation, rule (a): `docs/design/people-s8-instagram-label.md` is not inside `src/modules/dancer-app/`, not a test, not a seam. Because the PR changes `src/modules/dancer-app/public-page/model.ts` it counts as a dancer-area PR, and the allow-list `scripts/dancer-area-isolation-allowlist.json` only lets doc changes under docs/handover/, docs/journeys/, docs/review-pack(s)/, docs/people-arc/. The builder ran every job it could think of except this one (it lives in `unit-tests.yml`). I confirmed it by running `DANCER_ISOLATION_BASE=origin/main node scripts/check-dancer-area-isolation.mjs` on the branch head: 1 violation, that file.

## Do
1. `git mv docs/design/people-s8-instagram-label.md docs/people-arc/s8/DESIGN.md`.
2. In docs/people-arc/s8/HANDOVER.md fix the "Design record" link to `DESIGN.md` and add one clause saying why it lives here (the isolation rule (a) above). Fix any other reference (grep the old path across the repo).
3. Do NOT edit the allow-list or the script (owner decision; the question "should dancer-app PRs be allowed a docs/design/ record" goes in the handover as an owner call with your recommendation, one line).
4. Run, and paste the output lines in the handover: `node scripts/check-dancer-area-isolation.mjs --self-test`, then `DANCER_ISOLATION_BASE=origin/main node scripts/check-dancer-area-isolation.mjs` (must say OK), `npm run check:integrity`-equivalent from CI (`bin/check-integrity.sh` as the job runs it), `npx vitest run src/modules/dancer-app/public-page`.
5. Re-read `.github/workflows/unit-tests.yml` and every other workflow that runs on a PR; run any step the builder's table (docs/people-arc/s8/HANDOVER.md "Checks") does not list and add it to the table. Say which.
6. Append "S8 continuation" to docs/people-arc/s8/HANDOVER.md: what changed, the check output, Verified / Not verified. Do NOT touch the PR body (the orchestrator owns it).

Rules: plain git only (never gh api), never merge/approve/--no-verify, Supabase not needed, no shell variables/loops. ONE push; last commit subject ends `[worker-done <ticket>]` (not [skip preview]). At 45% context start nothing new. Stop after the push and report: head SHA and per-check result.
