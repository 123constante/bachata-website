# E2E organiser logins for the real-RPC journey

The Website's organiser editor (`src/modules/organiser-self-serve`) had only MOCKED browser
tests: every `/rest/v1` and `/auth/v1` call was faked, so they proved the screens, never the
RPCs. This seed gives the E2E project (`srrpvuxldthwumzrngla`, see
admin `docs/e2e-test-project.md`) real organiser logins so one Playwright journey
can drive the editor against the real database.

- Seed: [`scripts/e2e/seed-organiser-real-rpc.mjs`](../scripts/e2e/seed-organiser-real-rpc.mjs) (this repo; `npm run seed:e2e:organiser-real-rpc`)
- Journey: `tests/e2e/organiser-real-rpc.spec.ts`, run by
  `npm run test:e2e:organiser-real-rpc` (own config `playwright.organiser-real-rpc.config.ts`;
  NOT in the smoke gate)

**E2E only.** Both refuse to run when any configured URL, ref or key is prod
(`stsdtacfauprzrdebmzg`) or is not the E2E ref. Neither ever needs a prod key.

## What the seed makes

| Fixture | How (the real contract, not raw inserts) |
|---|---|
| owner user `e2e-organiser-owner@fixtures.bachata-admin.test` | GoTrue admin API, `email_confirm: true` (no email sent) |
| contributor user `e2e-organiser-contributor@fixtures.bachata-admin.test` | same |
| organiser "E2E Real RPC Organiser", London, **live** | `create_organiser_profile_v1` as the owner, `submit_organiser_profile_v1`, `admin_approve_entity_v1` as the E2E admin |
| owner membership, role `owner` | written by `create_organiser_profile_v1` itself |
| contributor membership, role `contributor` | `admin_add_entity_member_v1` called BY THE OWNER (the owner-gated path) |

It then signs both users in with their passwords against E2E GoTrue and reads
`organiser_home_v1` with each token: the owner must see the organiser as `owner`; the
contributor must NOT see it (D-8: that RPC lists owner/manager organisers only).

Users get passwords (not only magic links) because the journey signs in as them. The site has
no password form, so the journey signs in from Node with `signInWithPassword` (real GoTrue) and
places the session in the browser's localStorage.

No series is seeded: the journey creates its own, through the editor. E2E has no legacy
`events` table; everything is `event_series_p5` / `event_occurrence_p5`, like the existing
`audit1006-thursday-class` fixture.

## Idempotent

Every step looks before it writes. A re-run resets both passwords to the env values, adopts the
existing organiser (matched by name AND creator), and adds the contributor only if missing. If
the contributor somehow also holds `owner`/`manager` on the organiser, the seed FAILS rather
than demoting silently (the journey's refusal step would be meaningless).

By default a run also deletes the series earlier journey runs created (name `RPC Journey ...`,
this organiser only) and their uploaded flyers in `organiser-flyers/<series_id>/`, so the R5
daily cap (10 series per organiser per 24h) never blocks a re-run. `--keep-journey` skips that.

## Credentials (env only, never committed)

| Variable | Needed by |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | seed (Management API PAT; SQL as postgres on E2E; fetches the E2E service/anon keys into memory) |
| `E2E_ORGANISER_OWNER_PASSWORD`, `E2E_ORGANISER_CONTRIBUTOR_PASSWORD` | seed and journey (choose them; 10+ characters) |
| `E2E_ORGANISER_OWNER_EMAIL`, `E2E_ORGANISER_CONTRIBUTOR_EMAIL` | optional overrides of the defaults above |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | journey: the E2E URL and E2E anon key (the dev server and the Node sign-in use them) |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | journey, optional: a pinned Chromium (cloud image: `/opt/pw-browsers/chromium`) |

In a cloud session put the two passwords in the environment's variables; locally put them in
`.env.local` (gitignored). The E2E-only cloud environment's `VITE_SUPABASE_ANON_KEY` is the E2E
anon key, so `VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_ANON_KEY"` works there.

## Run

```bash
# seed (or repair) the fixtures; prints PASS/FAIL per step, never a password
node scripts/e2e/seed-organiser-real-rpc.mjs --dry-run   # plan only
node scripts/e2e/seed-organiser-real-rpc.mjs

# the journey (starts its own dev server on :4191 with the self-serve flag on)
VITE_SUPABASE_URL=https://srrpvuxldthwumzrngla.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=<E2E anon key> \
npm run test:e2e:organiser-real-rpc
```

Exit codes (seed): 0 seeded and verified, 1 a step failed, 2 refused / missing input.
Screenshots (390 px) land in `test-results/organiser-real-rpc/`.

## After an E2E rebaseline

Admin `docs/e2e-db-rebaseline-runbook.md` recreates the public schema; the
fixture organiser and memberships go with it (the auth users survive). Re-run the seed: it
rebuilds what is missing.
