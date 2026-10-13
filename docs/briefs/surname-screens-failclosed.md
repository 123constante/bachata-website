# Brief: surname screens must fail closed when the DB function is absent (Website PR #746)

Repo 123constante/bachata-website. Read CLAUDE.md and `docs/briefs/surname-screens.md` + `docs/briefs/surname-screens-handover.md` on branch claude/surname-screens first. Never merge, never --no-verify, push once. Push ONLY to `claude/surname-screens` (PR #746, head 23f5e8b); you are the only worker on it.

## CI rule (owner decision 2026-10-13)
GitHub Actions on `claude/*` branches may refuse to start ("payments have failed"): not a code failure. Run every CI job step (read .github/workflows) in your sandbox and put a per-job table (command, exit code) in the PR body and handover. Nobody runs anything on the owner's PC.

## Problem (measured)
On #746's Vercel preview (which talks to the PRODUCTION database, where admin PR #794 is NOT applied yet) `lighthouse`, `og-preview` and `seo-preview` fail: `sitemap fetch ... failed (HTTP 500)`, OG pages measured 2/4. Most likely cause: the new calls to `get_public_dancer_names_v1(uuid[])` (does not exist in prod until #794 is applied) throw during SSR for sitemap/og/person pages. Confirm the cause first (run the sitemap and og routes against a stub that returns "function not found" PGRST202 / 404 and compare with main).

## Task
1. Fail CLOSED and never throw: a single shared helper wraps `get_public_dancer_names_v1`; on ANY error (function missing, network, partial result) it returns first-name-only public names (derive from the data already fetched without the surname; never fall back to a direct select of `surname` / `display_name`), logs once at warn level with a stable code, and never breaks sitemap, og, meta, JSON-LD or page rendering. Ids missing from the result are rendered with the first name only.
2. Deploy order stays: #794 applied, then this PR; but the PR must be green and safe BEFORE that (previews and a rollback window).
3. Tests, table-driven, red first: (RPC ok | PGRST202 function missing | network error | empty result | partial result) x (person page, line-up credit, search result, teacher/DJ card, sitemap, og/meta title, JSON-LD): never a 500, never a surname in the failure cases, first name shown.
4. Run the lighthouse/og/seo preview scripts as the workflows do against a local build with the stub, plus every other CI job step; fill the per-job table. Update the PR body (`## Verified on real data` exact heading with `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:`).

## Output
New head SHA, per-job table, honest Verified / Not verified. Stop after the push.
