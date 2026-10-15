# Dancer Account Rebuild: COMMON RULES for every worker (read with your own brief)

You are a zero-context cloud worker. The orchestrator cannot be messaged by you; it watches git.
These rules come from the owner and bind every slice.

## Read first, in this order
1. Your own brief (`briefs/dancer-rebuild-<slice>.md` on branch `arc/briefs-dancer-rebuild`).
2. `briefs/dancer-rebuild-INTERFACE.md` (same branch): the pinned names, shapes, codes, routes, seams.
3. `briefs/dancer-rebuild-PLAN.md` (same branch): the change table at the top, then sections 1-8 and
   Appendix A. Later sections win over earlier ones; the INTERFACE file wins over the plan on names.
4. The repo's `CLAUDE.md` and `docs/agent-policy.md` (admin) / `CLAUDE.md` + `.claude/rules/*.md`
   (Website).
How to read a file on another branch WITHOUT `gh api` (Website repo: `gh api` sits behind an approval
prompt no worker can answer; admin repo: prefer the same): `git fetch origin arc/briefs-dancer-rebuild`
then `git show FETCH_HEAD:briefs/dancer-rebuild-INTERFACE.md`. Read Website source from `origin/main`
with `git show origin/main:<path>` when your checkout is not on main.

## Hard limits
- Never merge, never approve, never `--no-verify`, never edit `.githooks/` or any enforcement hook.
- Supabase: prod (`stsdtacfauprzrdebmzg`) is READ-ONLY (SELECT only, counts only, no personal data in any
  doc). Writes only on E2E (`srrpvuxldthwumzrngla`) or a Supabase branch, and only when your brief says so.
- Never open a sign-in page (Vercel, GitHub, Supabase dashboard). Use tokens from the environment or
  report "needs owner: <what>" and continue.
- The Website repo is PUBLIC: no secret, token or email address in any commit, doc or PR body.
- Shell commands: plain commands, no variables, loops or `$(...)` where a plain command works (the
  cloud command classifier stops on them and you would wait for an owner who is not there).
- Check a PRODUCTION build (`npm run build`), not only the dev server, before saying a page works.
- `gh pr create` with the bot token from the environment (`GH_TOKEN`); never the GitHub MCP create tool.

## One branch, one push
- Work and push ONLY on the branch your brief names. Create it from the base the brief names.
- PR BATCHING (docs/pr-batching-policy.md): ONE branch, ONE PR (or NO PR when the brief says the
  orchestrator merges your sub-branch). Push ONCE when finished. No follow-up PR for your own mistakes:
  fix them on this branch first. Migration? Fixture refresh and contract test ride in the same change.
  Docs / handover / test-only changes ride with it. Checkpoint progress in your handover doc, not in
  extra pushes. If the whole job would be under ~50 lines, stop and say so in the handover.
- Your LAST commit subject ends with `[worker-done <ticket>]` (the ticket is in your dispatch prompt).
  A read-only worker that changes nothing pushes one empty commit with that subject to
  `claude/done-<ticket>` instead.

## CI without GitHub billing (owner decision 2026-10-13)
GitHub Actions on billed runners fails intermittently with "recent account payments have failed or your
spending limit needs to be increased" (jobs die in ~2 s with zero steps). A red whose annotation says that
is NOT a code failure. Therefore: read `.github/workflows/*.yml`, run EVERY job step yourself in your
sandbox, and put a per-job table (job, command, exit code, result) in your handover and PR body. Say
plainly what a sandbox cannot run (Docker, local Supabase, a real phone). Real GitHub results win when
they actually run.

## Definition of done (binding, from the owner's CLAUDE.md)
Nothing is "ready" until: (1) the real data SHAPES were surveyed read-only (counts only) and named;
(2) every screen x every shape is covered by table-driven tests: the same fact reads the same on every
screen through ONE mapping; no text points at a control that is not on screen; every empty state says
what the person CAN do; a control that cannot work is disabled WITH a reason; saving an untouched record
sends nothing; (3) every CI job step run; (4) a 390x844 walk in a real browser on prod-shaped data where
the sandbox allows it (else the exact walk script is written for the orchestrator); (5) an honest
`Verified / Not verified` block. Red-first: any bug-shaped test is shown FAILING on the unfixed code
first (name the test and quote the failure in the handover).

## PR body (when your brief says to open a PR)
Use `.github/pull_request_template.md`. Website PRs MUST carry a `## Verified on real data` section with
the sub-headings `Shapes surveyed`, `Checks run`, `NOT verified` (the `real-data-verified` workflow fails
otherwise) and a `## Phone QA` section (viewports, measured results or NOT RUN with the reason). Admin PRs
with a migration carry the review verdict, proof receipts and `## DECISIONS`. Every PR body carries the
per-job CI table and `## DECISIONS` (every choice made without asking, one line each).

## Handover doc (always, even at a context gate)
Create the handover file your brief names on YOUR branch, update it before every stop. Sections: What
changed (files), Decisions and INTERFACE deviations, Shapes surveyed, Red-first proof (test -> failure
quote), CI per-job table, 390x844 walk (done, or the script), Verified / Not verified, What is left.
Then commit, push once, and report: branch head SHA, PR number if any, checks per job, Not verified.

## Context limit (owner rule 2026-10-15, binding)
Never go past 30% of your context window. Check your context use after every major step. At 25% stop
starting new work; by 30% commit, push, write the handover (done / left / exact next steps) with a last commit subject
ending "PARTIAL [worker-done <ticket>]". A fresh worker continues from your handover. Keep tool output small (head, tail,
grep; never whole files, whole logs or whole test runs printed).
