# Brief W1b: continue PR #1002 (seen-in-lists writer) -- conflicts + CI (normal lane, one push)

Repo 123constante/bachata-website, branch `claude/seen-in-lists-web` (PR #1002, head 53c37515). Read the original
brief `briefs/seen-in-lists/W1-writer.md` (branch `brief/seen-in-lists-web`) and the previous worker's handover
`docs/session-handover-2026-10-24-seen-in-lists-web.md` on the PR branch. Do NOT redesign the hook.

Why: PR #1002 is CONFLICTING with main (`src/components/calendar/CalendarListView.tsx`, `src/pages/FestivalHub.tsx`),
so GitHub ran no pull_request checks at all.

Do:
1. `git merge origin/main` into the branch (merge, not rebase; no force push). Resolve both files keeping main's
   changes AND the impression ref. Re-run the 23 impression tests.
2. Decided: TeacherProfile has no upcoming list, so `profile` covers DJ only for now: say so in the PR body. `city` on
   the SEO city list (`LiveEventsSection`) is correct.
3. Add the missing unit check: with `enableEventTracking` or `listImpressions` false, zero calls (if not already).
4. Run EVERY CI job step from `.github/workflows/*.yml` that runs on pull_request (read them), in this sandbox where
   it can; per-job table in the PR body (pass / fail-also-on-main / could not run + why). If `react-router dev` is
   OOM-killed again, try `npm run build` + the preview server, with NODE_OPTIONS=--max-old-space-size=3072; if the
   phone e2e still cannot run, say so plainly (the orchestrator walks it).
5. Update the PR body: what changed, Verified / Not verified. Push ONCE (no [skip preview]: the orchestrator needs the
   preview to walk at 390x844).
