# Brief: draft the ONE review pack for the account-system merge train (admin #820, Website #762, Website #775) - docs only

Repo `123constante/bachata-website`. Create YOUR OWN branch `claude/account-pack-draft` from `origin/claude/account-grid`
(head d9ac066). Change NO code. Commit only `docs/review-packs/account-system/PACK.md` (+ copies of existing screenshots
into `docs/review-packs/account-system/shots/` if useful). The orchestrator turns your file into the owner's page, so
write plain words a non-developer reads on a phone in 5 minutes; developer detail goes in a short appendix.

## Sources (read all; quote facts, never invent)
- Website `claude/account-grid`: `docs/account-system/{DECISIONS,ACCOUNT-MODEL,JOURNEY-GRID}.md`, every
  `docs/handover/account-grid-*.md`, `docs/review-packs/account-grid/*`, shots under `docs/handover/shots-*`.
  Review branches: `claude/account-grid-3ad-review` (REVIEW-3AD.md), `claude/account-grid-3c-review` (REVIEW-3C.md),
  `claude/account-grid-3b-review` (REVIEW-3B.md).
- Website PR #762 branch `claude/site-legal-pages` (/privacy, /terms, `legalVersions.ts`).
- Admin repo `123constante/bachata-admin` branch `claude/account-system-db` (PR #820, head f7b5a16): its migrations
  `supabase/migrations/202611221*`-`2026112237*`, `docs/handover/account-system-*.md`, and branch
  `claude/account-system-db-verify` `VERIFY-REAL-DATA.md`.
  (`git fetch https://github.com/123constante/bachata-admin <branch>` then `git show FETCH_HEAD:<path>`.)

## PACK.md sections (in this order)
1. **What changes, before vs after** - per person-facing journey: sign-up, sign-in code box, consent, sign-out (this
   device / all devices), settings, delete account (= hidden, restore by signing in within 30 days, kept after, admin
   erases on a GDPR request), restore, deleted card, landing after sign-in, Continue-as, invite card, /privacy + /terms.
2. **Tour** - for each changed screen: the screenshot path(s) that exist, and one line "what to look at".
   List screens with NO screenshot plainly.
3. **Decisions made for the owner** - every decision logged in handovers/reviews/DECISIONS.md that the owner did not
   click, each with its reason. Must include at least: support@bachatacalendar.co.uk as contact; erase_requested_at drop
   deferred; contrast-test runs locally/worker only (no new CI job); success notice neutral slate; D4 = 100% dancer goes
   straight on (no end card), 70-99% sees it; notes.tsx comment update deferred to a dancer-app-only PR; consent
   timeout 2.5 s; TERMS_VERSION 2026-10-16; accept_terms_v1 stays behind the dancer-area gate (card hidden when the
   gate is closed); one extra deletion-status read per shell mount (30 s cache).
4. **What it touches on prod** - #820: every migration file, in plain words (new RPCs, revoked RPCs, unscheduled cron
   `account-erase-due`, blocklist seed, funnel table, guard); rows changed by the apply (count any data writes); who
   notices; how to undo each (be honest where undo is a new migration). #762 + #775: Website only, no data.
5. **Verified / Not verified** - from the handovers' tables: per job command + exit, red-first proofs, mutation proofs,
   the #820 real-data verify (state it ran on a LOCAL replay with a synthetic prod-shaped seed, not a Supabase branch
   DB). GitHub checks: #820 all green at f7b5a16; #762 all green at a993804; #775 at d9ac066 all green except
   `unit (Europe/London, full)`, whose 2 failing files (organiser DatePage, levelsByType) ALSO fail on main 070c320 when
   re-run on 2026-10-16 (date drift on main, not this PR). Not verified: real phone keyboard, real e-mail code delivery,
   live deletion on prod (needs #820 applied), Vercel preview walk (orchestrator does it).
6. **Merge order** - owner approves + applies #820 -> orchestrator checks prod -> merge #762 -> merge #775 ->
   orchestrator checks the live site. Say why #762 and #775 must ship together (terms links 404 without #762).
7. **Phone checklist draft** - 3-6 steps on the live site after the merges (sign in, settings, delete + restore with a
   test account, /privacy), each: URL, what to tap, what they should see. Mark it DRAFT: the orchestrator walks each first.
Appendix: commit SHAs per slice, file counts, open "left" items that are NOT in this train.

Final commit subject ending `[worker-done <ticket>]`; push YOUR branch only, then stop.

## Rules
Plain git only, never `gh api`. Supabase READ-ONLY (you should not need it). Never merge/approve/`--no-verify`. Shell
commands without variables, loops or `$(...)` where a plain command works. At 25% context start nothing new; by 30%
push `PARTIAL [worker-done <ticket>]` with what is left.
