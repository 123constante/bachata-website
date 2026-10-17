# FINISH B1b (Website). Branch: claude/dancer-app-r1b (the integration branch, head d9828bda; you are the ONLY worker on it). Model: Opus.
Read dancer-rebuild-COMMON.md and dancer-rebuild-b1b-COMMON.md (briefs branch arc/briefs-dancer-rebuild: `git fetch origin arc/briefs-dancer-rebuild`, `git show FETCH_HEAD:briefs/<file>`).
The independent review is on branch claude/review-dancer-app-r1b: `git fetch origin claude/review-dancer-app-r1b` then
`git show FETCH_HEAD:docs/review-pack/review-dancer-app-r1b/REVIEW.md`. READ IT FIRST. Findings F1..F22 are your work list.
This is the ONE fix pass. Plan as author + continuation: if you reach 25% context, push PARTIAL with a handover and stop.

## Owner decisions already made (do not re-ask)
- F1: apply the exact allowlist edit in the review (Q4) to `scripts/dancer-area-isolation-allowlist.json`. This is an orchestrator-approved seam change (owner rule 2026-10-17). Note it in the PR body.
- F5: the Going lock stays a BROWSER-ONLY lock (no database change, no migration). Fix the false comment in `useGoingLock.ts`, say plainly in the PR body and handover "the server does not refuse an incomplete profile's RSVP; only the button does".
- F7: Home's "Upcoming nights" tile and the strip must show ONE number from ONE source. Use `my_dancer_stats_v1.nights_going_upcoming` (scheduled occurrences, so cancelled nights do not count) for both; keep the nights LIST as is. Table test over shapes: person going to a cancelled night, an ended series, zero, huge.
- F2: pin `gate/useDancerArea.ts` and `gate/useGoingLock.ts` into the existing manual chunk group that fixes the ratchets; do NOT raise any ratchet or budget to get green (F20: re-measure the dancer-app budget after, rewrite the note to describe the merged head).
- F4: map language codes to names with `Intl.DisplayNames`; unknown codes are hidden (never shown raw). Add `en`/`es`/`it`/`de` + unknown shapes (red-first, show it failing before).
- F18: neutral share title for a nameless profile, keep as is ("Dancer on Bachata Calendar") but make it a documented constant.
- F17: do the cheap half only: fetch extras only after the open flag says open. For the purge-on-eligibility-change half, do NOT touch the database; list it in the handover as an owner follow-up.
- F22: add a contract test (unit, offline) that pins the 5 new RPC names + parameter names used by `api/rpc.ts`; regenerating generated types is optional.
- All other findings (F3, F6, F8-F16, F19, F21): fix as the review says; F19: accept and write it in the PR body.

## Then, in this order
1. Fix F1-F22 as above (red-first for each bug-shaped one, name the test and quote the failing output before the fix).
2. Run EVERY job step of every `.github/workflows/*.yml` (and `npm run build`, `npm run typecheck` new-error count vs main) on the integrated head, plus the 360x640 and 390x844 phone suites. Per-job table (job, command, exit code) in the PR body and handover. A job that reds on `origin/main` too: prove it with the same command on main.
3. Walk at 390x844 in a real browser on the BUILT app (a) the public page `/dancers/<slug>` for 6 real shapes from prod (nameless, photoless, languages, gallery, instagram+city, archived => not found) with the flag on and, via a local override, off; (b) the Going lock on an event page and the festival hub (signed-in incomplete profile on the fake backend, plus signed-out); (c) `/app/home`, `/app/page`, Options feedback sheet, partner tile on the fake backend in the shapes: zero, normal, huge, error. Save PNGs (<= 150 KB each, 390 wide) under `docs/review-pack/r1b/` with `captions.md` (one plain sentence per image: what to look at). Do not write personal data into any caption.
4. Write `docs/handover/dancer-rebuild-b1b-finish.md` (fixed finding -> commit, per-job table, shapes surveyed, Verified / Not verified, owner follow-ups).
5. Open ONE PR as the bot (`gh pr create`, base main, head claude/dancer-app-r1b, title "PR B1b: dancer app 1b (public page v2, Going lock, stats, my page, feedback)"). Body from `.github/pull_request_template.md` with `## Verified on real data` (sub-headings `Shapes surveyed`, `Checks run`, `NOT verified`), `## Phone QA`, `## DECISIONS`, the per-job table, and a first section in plain words "What goes live for everyone when this merges: the public dancer page v2 (the beta switch is ON)".
6. Push ONCE at the end; last commit subject ends `[worker-done <ticket>]`. Stop after the push and the PR. Never merge or approve.
