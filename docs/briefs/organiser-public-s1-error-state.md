# Brief: S1 -- public organiser page shows an ERROR state, not a false empty state (Opus, normal lane, Website only, no DB)

Branch `claude/organiser-public-s1-errors`. Read first: `docs/inventory/organiser-public-verify.md` (E4, section 4 S1) and `docs/inventory/organiser-public-page.md` on branches `claude/organiser-public-verify` / `claude/organiser-public-inventory`. Owner words 2026-11-02: "I like the design roughly but there seem to be some errors." This is the serious one: a transient RPC error currently renders "No nights listed yet" for an organiser with 200 events, cached 5 min in the browser and dehydrated into SSR HTML.

## Facts (verified on prod and in code)
`fetchOrganiserEvents` (src/modules/profile/organiserPublicProfile.ts ~115), `fetchOrganiserFutureOccEvents` (~127), `fetchOrganiserPastOccEvents` (~147) and the team query (src/pages/OrganiserProfile.tsx ~788) all `return []` on error, so React Query never retries. `app/routes/organiser.tsx` ~107-126 prefetches the same three functions and its comment relies on the swallowing, so one SSR error puts the empty state into served HTML.

## Do
1. Fetchers throw on RPC error (keep returning [] for a real empty result). React Query retries; the page shows, in place of the events/team section, a quiet one-line state "Couldn't load dates. Try again" with a retry button (44px tap target, explicit px sizes). Past and upcoming fail independently; one failing must not hide the other.
2. SSR loader: a failed feed must NOT be dehydrated as `[]` or cached as success (no cache tag on a failed prefetch; client refetches). Prove with a test.
3. RED FIRST, table-driven: {upcoming, past, team} x {ok with data, ok empty, error} -> assert error never renders the empty-state copy ("No nights listed yet", past-only/none boxes), ok-empty still renders today's boxes unchanged, retry refetches. Paste the red count from main.
4. Do NOT change any empty-state wording or layout (decisions D1-D5 are separate slices). No DB change. Keep /app first-load bytes unchanged: run `npm run check:bundle-budget` on main and branch and report numbers.
5. Run lint, tests for src/pages and src/modules/profile, tsc errors in touched files. HTML entities for punctuation. Real-data block in the PR body: prod shape counts are in the verify doc.

BASE CHECK: `git fetch origin main`, branch from it, `git merge-base HEAD origin/main` must equal `git rev-parse origin/main` before pushing; check the PR is not DIRTY after. Context cap 50%. Handover `docs/handover/organiser-public-s1.md`. Last commit subject ends with the done marker from your prompt.
