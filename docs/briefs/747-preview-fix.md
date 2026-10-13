# Brief: PR #747 breaks pages on the Vercel PREVIEW (fix on claude/website-small-queue)

Repo: 123constante/bachata-website. Branch to fix: `claude/website-small-queue` (PR #747, head f50eff1). Read docs/agent-policy.md first.
You are a FRESH worker. The previous worker's CI was all green, yet the owner's phone check on the PR's Vercel preview found real breakage that CI did not catch.

## What the owner saw (preview URL https://bachata-website-git-claude-website-s-fe1212-rixz-4372s-projects.vercel.app)
- `/parties`: stuck on grey skeleton rows forever. Browser console: `TypeError: le is not a function` at assets/vendor-ui-DCvdHbop.js:1:3129 (called from vendor-ui-modal-*.js). The LIVE site www.bachatacalendar.co.uk/parties works, so this is new on the branch (or the preview build).
- `/event/34156f15-bf26-42bc-b6f1-bfb73007da43`: header, poster, organiser render, but the SCHEDULE card says "Loading..." forever.
- `/organisers/<any>`: owner reported an error (no detail). Check it too.
- Home `/` is fine.

## Task
1. Reproduce in a PRODUCTION build (`npm run build`, then serve the build; a dev server hides chunking bugs) at the branch head AND at main. Say which one breaks.
2. Find the cause. Prime suspects: removing exports (`useProgrammeNationalities`, `withNationalities`, `parseProgrammeNationalities`) from EventScheduleGrid changed the chunk graph / a circular import so `vendor-ui` gets an undefined function; or `.route-shell` / PageTransition changes. Do not guess: bisect by reverting one file group at a time in the built output.
3. Fix it on `claude/website-small-queue` (push ONLY that branch). Keep the four fixes if possible; if one must go, drop that one and say so in the PR.
4. Add a gate so this class cannot pass CI again: a check that loads `/parties`, `/event/<a live uuid>` and an organiser page from the PRODUCTION BUILD and fails on any uncaught `TypeError` or a skeleton/"Loading..." still showing after 8 s (fakeSupabase is fine). Prove it red on the broken head first (red-first), then green.
5. Run every CI job step from .github/workflows yourself in your sandbox (GitHub Actions billing is intermittent; a red with 0 steps and a "payments have failed" annotation is not code). Put the per-job table (command, exit code) in the PR body. Note what a sandbox cannot run.
6. Update the PR body: what broke, why CI missed it, the fix. Leave a handover doc on the branch (docs/session-handover-2026-10-13-747-preview-fix.md) after each major step.

## Boundaries
Never merge or approve. Never `--no-verify`. Prod DB read-only via the Supabase connector only. Push once the targeted tests pass (the pre-push hook runs the full suite). Do not touch other branches. STOP after the push and report: the cause in two sentences, the gate you added, and the per-job table.
