# W1 split: make PR #893 pass dancer-area-isolation (Website)

Repo: 123constante/bachata-website. Work branch: `claude/w1-people-surfaces` (PR #893, head be098eb).
Read first: `docs/handover/w1-finish.md` on that branch (the previous worker's handover; its
"Status: NOT ready" section explains the red gate), and `scripts/check-dancer-area-isolation.mjs` header.

## The failure (in the owner's words: "is it working?" -- not yet: one CI gate is red)
`npm run check:dancer-area-isolation` exits 1 with 93 violations. W1 edits 7 files under
`src/modules/dancer-app/public-page/`, which turns #893 into a "dancer-area PR", so rule (a) flags every
changed file outside that folder; rule (c) flags `src/pages/DJProfile.tsx` importing
`@/modules/dancer-app/public-page/model` (SHARE_MESSAGES, shareDancerPage, ShareOutcome).

## Orchestrator decision (already made; do not re-open)
Option B + a seam:
1. **Split.** PR #893 must change NOTHING under `src/modules/dancer-app/`. Restore those 7 files to their
   `origin/main` content on `claude/w1-people-surfaces`, and make whatever OUTSIDE code depended on the W1
   versions compile and pass against main's versions (e.g. `src/pages/DancerProfile.tsx` and any test that
   passes/expects `extrasOk`). Behaviour lost from #893 by this: 7f "New this year", C9 `extrasOk` removal,
   and whatever S2 changed in `PublicDancerPageV2.tsx` -- name each in the handover.
2. **Follow-up record (no second branch: you push ONLY `claude/w1-people-surfaces`).** The dancer-app edits
   will be re-applied later by another worker as their own PR, from be098eb. So in the handover list, exactly:
   every file you changed OUTSIDE `src/modules/dancer-app/` in step 1 (path + what you reverted and why), so
   that worker can re-apply `git checkout be098eb -- src/modules/dancer-app` plus those outside hunks. Also
   prove it works: in a scratch worktree, apply that re-application on top of your head and run
   `check:dancer-area-isolation` with `DANCER_ISOLATION_BASE=<your head>`, plus the affected vitest files; report
   the result (do not push that worktree).
3. **Seam for DJProfile.** Add `src/pages/DJProfile.tsx` to `seams` in
   `scripts/dancer-area-isolation-allowlist.json`, with a `seamNotes` entry:
   "W1 S2 DJ role page (orchestrator 2026-10-21): reuses the public dancer page's share helper (SHARE_MESSAGES, shareDancerPage) instead of a second copy". No other seam. Do not edit the check script.

## Gates (run every CI step; GitHub Actions may be refused by billing)
- `npm run check:dancer-area-isolation` = 0 on `claude/w1-people-surfaces` (base origin/main).
- Every CI job step from `.github/workflows` that the previous handover's table lists, on your final
  tree, compared to origin/main as that table did (same-on-main failures are fine, name them).
- The FULL phone-qa suite (`playwright.phone.config.ts`) once on `claude/w1-people-surfaces` (the last
  worker only re-ran the /dancers rows after its spec edit). Run it in the FOREGROUND with `timeout 1500`.
- `npm run build` (production build).
- Red-first: show the isolation check failing at be098eb and passing at your head.

## Working rules
- One push, at the end, of `claude/w1-people-surfaces` only, carrying `[worker-done <ticket>]`.
- Read and push with plain git only. `gh` is NOT authenticated here and `gh api` stalls on a prompt: never use it.
- Write shell commands without variables, loops or `$(...)` where a plain command works.
- No sub-agents (Task/Agent) and no `run_in_background`/nohup waits: the previous worker lost time on them.
- Never merge or approve; never `--no-verify`; Supabase read-only; no workflow or secret edits.
- Plan this as author + optional continuation: at 25% context start nothing new; by 30% push with
  `PARTIAL [worker-done <ticket>]` and a handover.
- Handover: update `docs/handover/w1-finish.md` (section "Split pass"): what moved, the gate table, the
  follow-up record from step 2, and a REPLACEMENT "PR body (paste into #893)" section that no longer claims
  7f/C9/the dancer-page items, with a "Follow-up PR (dancer page)" paragraph. Keep its Phone QA and
  Verified / Not verified sections, updated.
