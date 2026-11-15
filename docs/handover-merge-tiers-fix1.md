# Handover -- merge-tiers fix round 1 (PR #1679, branch claude/merge-tiers)

Brief: `brief/merge-tiers:docs/briefs/merge-tiers-fix1.md` (blob 2c3af89a). Flag stays OFF (`MERGE_TIERS_ENABLED`).

## Done (all five)
1. **Bot author only** -- `scripts/owner-approval-audit.mjs` `decideAudit`: the tier-B shortcut needs
   `pr.author === BOT_LOGIN` (`kiki-claude-bot`). `auditCommit` now carries `author` (PR `user.login`).
   A human or any other author with `## Self-review` stays RED.
2. **Real self-review** -- `scripts/lib/merge-tier.mjs` `hasSelfReview`: HTML comments stripped (single-
   and multi-line); a line counts only if it is not a placeholder (`-`, `TODO`, `n/a`, `none`, `tbd`,
   also as a `- ` bullet) and has at least 12 letters/digits.
3. **Merge-commit binding** -- the shortcut uses only the PR whose `merge_commit_sha` equals the audited
   sha (`auditCommit` passes `sha`, prs carry `mergeCommitSha`). No match, or no sha = no shortcut.
4. **revert-on-red** (`docs/proposals/revert-on-red.yml`): (a) `git revert --no-edit` conflict
   (then `--abort`) or a failed push -> `owner_turn` opens an `owner-turn` issue naming the sha, PR,
   the red workflow name + run URL and the branch, then `exit 0`. (b) duplicate guard: `pulls.list`
   `state: 'all'` for head `claude/revert-<sha8>` (open/closed/merged) plus a `/search/issues` search
   for the branch name in any issue/PR; every body this workflow writes now names the branch.
5. **SECRET** -- by basename: `.env`, `.env.*`, `.envrc`, `env.<x>`; `secret`/`secrets` only as a whole
   directory segment or a whole file stem (`secrets/x.json`, `config/secret.ts`, `secrets.json`).
   `docs/secret-santa.md`, `SecretMenu.tsx`, `environment.md`, `envelope.ts` are not secrets.
   **Judgement call:** "file stem word" read as "the stem IS the word", so `scripts/rotate-secret.mjs`
   moved A -> B (still hard tier, still needs a self-review from the bot). Owner/lead: if you want
   hyphen-words in code stems to stay A, that is a one-line change in `isSecretPath`.

Tests (tests/mergeTier.test.ts, 57 pass; 18 of them fail on the unfixed code): classifyTier secret
rows both sides; 9 placeholder bodies + a real-after-placeholder case; non-bot authors; other-PR /
mixed-PR / no-sha binding; revert-on-red owner_turn + any-state duplicate guard (text assertions on
the proposal YAML -- it is not executed).

## Not in scope (lead accepted)
Body edited after merge; auto-merge window between push and synchronize; 3000-file cap.

## Not verified
- revert-on-red is a proposal file: never executed in Actions (no real red main, no dry run).
- `GET /search/issues` indexing lag: an issue created seconds earlier may not be found; the any-state
  PR check and the branch `ls-remote` check still cover the PR/branch case.
- `npm run lint`: 35/36 links green; `check:no-social-word` is red on main already
  (`src/modules/tickets/__tests__/priceSteps.matrix.test.tsx:32`, not in this PR).
- Full `npm run test:unit`, e2e and browser walk not run (no UI paths in this PR).
