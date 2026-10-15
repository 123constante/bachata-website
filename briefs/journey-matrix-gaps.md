# Brief: full account-journey matrix, gap analysis (READ-ONLY)

Repo: 123constante/bachata-website. Read branch `claude/dancer-app-routing` (PR #764; another worker is pushing fixes
to it right now: never push it). Your output goes on `claude/journey-matrix` (new, from that branch's head).

## Why (owner's words, 2026-10-15)
"Have you covered every possible workflow the way the user signs up and accesses the profiles and goes back and
switches and has multiple profiles, etc.?" Today 18 entry journeys (tests/journeys/publicEntryJourneys.ts,
docs/review-packs/public-journeys/) + 7 switch specs (tests/e2e-build/dancer-app-routing.build.spec.ts) exist.
The owner must never be the one who finds a missing path.

## Task
Write `docs/review-packs/public-journeys/MATRIX.md`: a table with one row per combination of
- ENTRY: organiser link, dancer link, home banner, plain header sign-in, team invite e-mail, claim link, dancer
  invite e-mail (dancer-invite-send edge fn), deep link to /app/* and /account/*, Website footer/legal links;
- WHO THEY ALREADY ARE: no account; account with nothing finished; unfinished dancer; finished dancer; organiser
  only; dancer + 1 organiser; dancer + 2+ organisers; open organiser request; team member of someone else's
  organiser; admin; admin + dancer; account in erase grace period / erased then re-signing up;
- WHAT THEY DO: straight through; browser Back at each step; reload; close tab and come back by sign-in; magic link
  vs code; wrong/expired code; switch profile (sheet, Continue as...); sign out then sign in as a DIFFERENT person on
  the same browser; second tab / second device; open an old bookmarked URL.
Prune impossible combinations with a one-line reason. For each kept row: expected END screen + state (derive it from
`src/lib/accountRouting.ts` and the owner decisions in the journey map HANDOVER/WALK docs, never invent a new
rule; where code and decisions disagree or the code has no answer, mark DECISION NEEDED with Claude's default),
and COVERED BY: the unit row id / build spec name, or MISSING. Read prod shapes with the Supabase connector,
COUNTS ONLY (how many accounts are in each WHO bucket), to rank MISSING rows by real people affected.
End with: the MISSING rows ranked, and a proposed list of new `publicEntryJourneys` rows + build-walk specs
(names + END), sized for ONE follow-up worker.

## Rules
Read-only on src/ and tests/: change nothing but MATRIX.md. Plain git (never `gh api`, never a PR). Supabase:
SELECT counts only, no personal data. Shell commands without variables, loops or `$(...)` where a plain one works.
Context: at 25% start nothing new; by 30% push + `PARTIAL [worker-done <ticket>]`.

## Output
Push `claude/journey-matrix`; last commit subject ends `[worker-done <ticket>]`.
