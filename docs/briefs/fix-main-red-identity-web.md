# BRIEF: fix-main-red-identity-web (WEBSITE; branch `claude/fix-main-red-identity-web`; careful lane, hard tier; `Automation identity check` red on main)

Brief-version: 1
Owner decision 2026-11-05 (click): "drop the rule for now" -- remove the `["author","merge"]` pair from `separate_roles` in `.github/automation/secrets-register.json`. You never approve or merge, never print a token.

## Measured cause (run 41990183311 on 28439c89)
The run did NOT fail on the author/merge pair. It exited 2 "CANNOT RUN": `AUTOMERGE_TOKEN: credential not in env (secret missing or not passed)`. The Website has no `AUTOMERGE_TOKEN` secret at all (the workflow passes an empty value). `BOT_PR_TOKEN` resolved to `kiki-claude-bot` (acts_as is still null). So dropping the pair alone would stay red; the register must also say truthfully that the merge credential is not present in this repo.

## What main lacks
- A register that matches reality: the `AUTOMERGE_TOKEN` entry has `exists: true` but no such secret exists in the Website repo. grep: `"name": "AUTOMERGE_TOKEN"` in `.github/automation/secrets-register.json`.
- Note `scripts/autopilot-step.mjs` and `.github/workflows/autopilot.yml` read `env.AUTOMERGE_TOKEN` and handle it being absent (`mergeApi = env.AUTOMERGE_TOKEN ? ... : null`); confirm by reading, and do not touch them.

## What to do
1. Remove the `["author","merge"]` pair from `separate_roles`. Keep `["author","approver"]` and `["merge","approver"]`.
2. Set the `AUTOMERGE_TOKEN` entry `exists: false` with a dated note: "no AUTOMERGE_TOKEN secret in this repo (measured 2026-11-05, run 41990183311); owner dropped the author/merge separation 2026-11-05". Check `scripts/check-secrets-register.mjs` rules a-f still pass with `exists:false` (other `exists:false` rows are the pattern).
3. Record `BOT_PR_TOKEN` `acts_as: kiki-claude-bot` (state: measured 2026-11-05 by the identity check, run 41990183311) so the loud "to record" line goes away.
4. `scripts/check-identity-register.mjs` selftest (line ~176 uses `separate_roles: [['author','merge']]` as its fixture: that fixture tests the mechanism, keep it) and `tests/automationRegister.test.ts` A36 test (line ~366): make sure they do not depend on the shipped register's pair. Add a test that the shipped register has exactly the pairs author/approver and merge/approver, and that a credential resolving to the owner login still fails (the owner-login check is NOT dropped).
5. Docs: `docs/automation-foundations.md` (lines ~267, ~312) and `docs/handover/foundations-web.md` (~270-275, ~320): state the decision and date; remove "Owner decides" wording.
6. Change `.github/workflows/automation-identity-check.yml` only if needed so the check passes with one credential; do NOT make a missing credential that the register marks `exists:true` green.
7. Prove locally: offline `node scripts/check-identity-register.mjs`, `npm run check:identity-register`, the secrets-register check, the two test files. Run every CI job step that applies; per-job table and Verified / Not verified in the PR body, exact labels `Verified on real data:` and `NOT verified:`.
8. COMMITS: separate plain commands: `git add <files>`, `git commit -F <msgfile>`, `git push origin claude/fix-main-red-identity-web`. No `&&` chains, no `-c` flags, no inline multi-line `-m`. ONE push; final subject ends with the done marker of your ticket.

## Files
- .github/automation/secrets-register.json
- scripts/check-identity-register.mjs
- tests/automationRegister.test.ts
- docs/automation-foundations.md
- docs/handover/foundations-web.md
- .github/workflows/automation-identity-check.yml (only if needed)
