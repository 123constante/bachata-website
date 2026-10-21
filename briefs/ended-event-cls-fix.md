# Brief: ONE fix pass on Website PR #913 (ended-event page jump)

Repo `123constante/bachata-website`, branch `claude/ended-event-cls` (PR #913, head b87e817f). Push ONCE at the end.
This is the planned single fix pass after review; a continuation worker is normal if you hit the context limit.

## Read first
- The review: `git fetch origin claude/review-ended-event-cls` then
  `git show FETCH_HEAD:docs/reviews/review-ended-event-cls.md`, sections S1, N2, N3 (and N1 for context).
- The PR's own handover doc on the branch (docs/handover-ended-event-cls.md if present).

## What the owner saw, and the check that would have caught it
The owner saw an ended event's page jump as the organiser "door" (MoreEventsSection) filled in late. The PR prefetches
the door on the server with a 1.5 s budget. The review found that a FAILED door RPC is cached as an empty SUCCESS,
dehydrated into edge-cached HTML (s-maxage 3600), so every visitor gets NO door for minutes: hiding content, which the
owner ruled out. The missing check: a unit test where the RPC errors and the dehydrated state must not contain the door.

## Task (exactly these, nothing else)
1. **S1 (must).** In `src/modules/event-page/sections/MoreEventsSection.tsx`, `otherOrganisersQuery` queryFn: read
   `error` from the `get_organiser_event_counts` rpc AND from the `organiser_profiles` select, and `throw` each.
   The exact code is in the review S1. Leave `event_views` in `organiserEventsQuery` alone (review says so).
2. **S1 test (must, red first).** Add a unit test that mocks the rpc to `{ data: null, error }`, runs
   `prefetchEndedDoor` + `dehydrate(qc)`, and asserts there is no `more-events:other-organisers` entry.
   Run it against the UNFIXED code first and record the failure; then the fix makes it pass. Put both runs
   (command + result) in the handover.
3. **N3 (do).** `app/routes/event.tsx`: keep the budget timer id and `clearTimeout` it in a `.finally()` on the race.
4. **N2 (do).** In `tests/e2e/event-ended-cls.spec.ts`, when a slug no longer renders and the test skips, log the
   reason with `console.warn` (and in `test.skip`'s message) so a local run shows it.
5. N1 / N4: no code change. Add one line to the spec header comment: "serial mode: a red run shows only the first
   failing case".

## Gates (run them all, record command + exit in the handover)
- Read `.github/workflows/*.yml` for the jobs a PR runs; run every step you can in the sandbox
  (unit tests, `npm run lint`, typecheck, the check:* scripts the workflows call) and a PRODUCTION build
  (`npm run build`), not only the dev server.
- GitHub Actions may be refused for billing ("payments have failed / spending limit"): not a code failure.
  Your per-job table (command, exit code) in the handover is the fallback evidence.
- The PR body already has a passing `## Verified on real data` section (heading fixed by the orchestrator).
  Do NOT rename that heading. You may append to the body's Verified / Not verified section if you have new facts,
  but editing the body is optional; the handover doc is required.

## Boundaries
- Plain git only (`git fetch`, `git show`, `git push`). Never `gh api`.
- Shell commands without variables, loops or `$(...)` where a plain command works.
- One push at the end (Vercel deploy cap). `claude/*` branches build no preview, which is expected.
- Supabase read-only. Never merge or approve. Never `--no-verify`. No workflow or secret edits.
- 30% context limit: at 25% start nothing new; by 30% push what is safe + handover with a last subject ending
  `PARTIAL [worker-done <ticket>]`.

## Output
Last commit subject ends `[worker-done <ticket>]`. Handover `docs/handover-ended-event-cls.md` gets a "Fix pass"
section: what changed, red-first evidence, per-job table, Verified / Not verified. Stop after the push.
No other worker is on this branch.
