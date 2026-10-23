# Session handover 2026-10-23: W2-D hub build, PR watch (ticket dt_aee601072cb9)

Branch `claude/w2d-hub-build`, PR #963 (bot-opened, kiki-claude-bot). Build handover: `docs/handover/w2d-hub-build.md`.
Three workers have pushed to this branch: dt_aee601072cb9 (build, this session), dt_35ff972ae82e (stage-5 critique),
dt_ee031c530f23 (step 2: Back loop, gig wording). Head before this file: c384b2b.

## Done (this session)
- Built option C + one-role redirect + shared `personDestination` + footer fade + photo fallback (see the build handover).
- Fixed the PR body twice for the body checks: each label's text must sit on the same line as the label, and nothing
  may come between the label and its colon (a template phrase like "(read-only, counts)" there = "line is missing").
- ee25e19: the critique doc quoted a mojibake string literally and tripped the integrity guard; now described in words.
- Commented on #963: `datesCard.consistency.test.tsx` (organiser) fails `unit (Europe/London, full)` on main too
  (frozen clock 2026-10-20 vs real date >= 23 Oct); not this PR's, no fix exists yet.

## Open
- `unit (Europe/London, full)`: red only on that organiser test. Needs a separate organiser-side fix PR.
- PR body (step-2 worker) says #963 merges AFTER the `claude/oneback-no-hub-row` PR (4 oneBack cases red until then).
- real-data-verified re-runs on the body edit made at ~09:50 UTC; expected green (validated locally).
- Owner call listed in the PR: long wall date chip wraps to two rows.

## Next
1. Read PR #963 checks on the current head; anything red other than datesCard is this PR's to fix.
2. Fix (or get fixed) datesCard.consistency in its own PR; then re-check #963.
3. Never merge or approve.
