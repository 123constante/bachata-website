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
2. **Follow-up branch** `claude/w1-dancer-page`: created FROM your final `claude/w1-people-surfaces` commit,
   carrying ONE commit that re-applies exactly the dancer-app edits (from be098eb) plus the matching outside
   edits you reverted in step 1. On that branch `check:dancer-area-isolation` must also pass (it is a
   dancer-area PR there: every changed outside file vs `claude/w1-people-surfaces` must be a seam; run it with
   `DANCER_ISOLATION_BASE=origin/claude/w1-people-surfaces`, and report the result vs origin/main too).
   Do NOT open a PR for it; the orchestrator opens it after #893 merges.
3. **Seam for DJProfile.** Add `src/pages/DJProfile.tsx` to `seams` in
   `scripts/dancer-area-isolation-allowlist.json`, with a `seamNotes` entry:
   "W1 S2 DJ role page (orchestrator 2026-10-21): reuses the public dancer page's share helper (SHARE_MESSAGES, shareDancerPage) instead of a second copy". No other seam. Do not edit the check script.

## Gates (run every CI step; GitHub Actions may be refused by billing)
- `npm run check:dancer-area-isolation` = 0 on `claude/w1-people-surfaces` (base origin/main).
- Every CI job step from `.github/workflows` that the previous handover's table lists, on BOTH branches'
  final trees, compared to origin/main as that table did (same-on-main failures are fine, name them).
- The FULL phone-qa suite (`playwright.phone.config.ts`) once on `claude/w1-people-surfaces` (the last
  worker only re-ran the /dancers rows after its spec edit). Run it in the FOREGROUND with `timeout 1500`.
- `npm run build` (production build) on both.
- Red-first: show the isolation check failing at be098eb and passing at your head.

## Working rules
- One push per branch, at the end. Last push on `claude/w1-people-surfaces` carries
  `[worker-done <ticket>]`; push `claude/w1-dancer-page` BEFORE it.
- Read and push with plain git only. `gh` is NOT authenticated here and `gh api` stalls on a prompt: never use it.
- Write shell commands without variables, loops or `$(...)` where a plain command works.
- No sub-agents (Task/Agent) and no `run_in_background`/nohup waits: the previous worker lost time on them.
- Never merge or approve; never `--no-verify`; Supabase read-only; no workflow or secret edits.
- Plan this as author + optional continuation: at 25% context start nothing new; by 30% push with
  `PARTIAL [worker-done <ticket>]` and a handover.
- Handover: update `docs/handover/w1-finish.md` (section "Split pass"): what moved, the gate table for both
  branches, and a REPLACEMENT "PR body (paste into #893)" section that no longer claims 7f/C9/the
  dancer-page items, with a "Follow-up PR (claude/w1-dancer-page)" paragraph. Keep its Phone QA and
  Verified / Not verified sections, updated.
