# `tests/e2e-attic/` — retired E2E specs (kept, not deleted)

These specs are **not collected by any runner**. `playwright.config.ts` sets
`testDir: './tests/e2e'`, so this sibling directory is invisible to
`playwright test` — including the bare `playwright test` behind `test:e2e:all`,
which is what `e2e-nightly.yml` ran. (`test:e2e:all` is kept: it is still the
way to run the live smoke suite plus anything not in the explicit `test:e2e`
list, and it no longer has a scheduled caller.) They are kept in git, with
history intact (moved via `git mv`), because several encode real product
knowledge that is expensive to reconstruct.

## Why they were retired (measured 2026-07-31, not assumed)

They were the payload of `e2e-nightly.yml`, which this change deletes. That
workflow **never once passed**: 20 of the last 20 scheduled runs failed, back
through 2026-07-02.

The plan that scheduled this retirement described that history as "100% timeout
signal". **That description was wrong, and the real mechanism matters more.**
The runs did not time out — they finished comfortably inside the 45-minute limit
(11.1 min on 2026-07-31, 12 min on 2026-07-12, 8 min on 2026-07-02) and exited 1
on genuine assertion failures:

| run | date | result |
|---|---|---|
| 30603434894 | 2026-07-31 | 39 failed, 10 skipped, 15 passed (11.1m) |
| 29890147008 | 2026-07-22 | 38 failed, 10 skipped, 16 passed |
| 29179387613 | 2026-07-12 | 38 failed, 10 skipped, 14 passed, 2 flaky |
| 28565371521 | 2026-07-02 | 28 failed, 10 skipped, 25 passed, 1 flaky |

So these are not slow tests that need a longer budget. They are tests whose
preconditions no longer exist.

## The structural reason, which is not fixable by configuration

Since the SSR cutover, every one of these specs depends on something the CI
environment cannot supply:

- **Server-rendered routes.** Playwright's `page.route()` mocks patch the
  *browser's* network stack. They cannot intercept a server loader's `fetch`.
  Any spec visiting `/event/:id`, `/city/:slug` or `/` is unmockable by design —
  this is documented at length on `webServer.url` in `playwright.config.ts`.
- **Real data.** The specs that reached a real backend pinned specific event
  UUIDs and expected specific rendered strings. That data drifts continuously
  (the admin repo edits it daily), so the assertions rot on their own.
- **Secrets are not an escape hatch.** `e2e-smoke.yml` also runs on
  `pull_request`, and Dependabot PRs receive **no** repo secrets — an empty
  `VITE_SUPABASE_URL` makes `createClient` throw at module init and 500s every
  route, leaving every Dependabot PR permanently red. The comment in
  `e2e-smoke.yml` says exactly this; it is the reason the smoke suite runs on a
  placeholder key.

## What still covers this ground

- `e2e-smoke.yml` — client-only routes with browser mocks, on every PR and push.
- `prod-smoke.yml` — runs on `deployment_status`, i.e. against the real site
  with real data after every deploy. This is where "does the event page render"
  is genuinely answered.
- `synthetic-ssr-monitor.yml` — loads `/city/london-gb` every 6h against prod.

That split is the correct one: mocked specs test client logic, and the real site
is tested against the real site.

### What is genuinely LOST, stated plainly

An earlier draft of this file said retiring the nightly "does not drop the
coverage classes it owned". That was an overclaim and review caught it. Three
behaviours had their only automated assertions in this directory:

1. **`?occurrenceId` client-side routing** (`occurrence-aware-schedule.spec.ts`)
   — that `/event/:id` calls `event_view_p5(legacy_compat, series)` while
   `?occurrenceId=…` switches it to `occurrence` mode. Nothing else asserts the
   RPC-argument switch.
2. **Cancelled-occurrence DOM** (`cancelled-occurrence-proof.spec.ts`,
   `event-page-cancelled.spec.ts`) — the cancelled badge, the disabled RSVP
   button, the "no longer accepting RSVPs" helper, and that a click on the
   disabled button fires no RSVP request.
3. **Tonight near-me geolocation** (`tonight-location.spec.ts`,
   `home-map-location.spec.ts`) — grant/deny/postcode-fallback branches and the
   distance-sort behaviour.

The honest mitigation, which is why retiring still wins: **those assertions have
not actually run green since at least 2026-07-02.** They lived only in a job that
failed 20/20. Coverage that never passes is not coverage — deleting it loses
nothing that was being enforced, and it stops the red that was training everyone
to ignore CI. But the gap is real and should be closed deliberately, by rewriting
these against mocked client-only routes (classes 1 and 3 are good candidates —
both are client-side) or by adding them to `prod-smoke`'s real-site model
(class 2, which needs real cancelled data).

## What was admitted back into the smoke suite instead

Each remaining spec was run **individually** under the exact `e2e-smoke.yml`
environment (placeholder key), then the whole proposed set was run together
three times to check stability. Two earned admission to `npm run test:e2e`:

- `auth-stepper-smoke.spec.ts` (1 test)
- `auth-magic-link-returnto.spec.ts` (2 tests)

Both are client-only auth routes that pass reliably on the placeholder key.

**A methodology note worth keeping.** Running the full suite at once produced
failures for three specs that pass in the smoke job and pass in isolation
(`auth-stepper-email-routing`, `vendor-city-normalization-smoke`,
`dancer-dashboard-concept-b-smoke`). That was a `fullyParallel` cold-server
contention artifact, not a signal. Judge a spec by running it the way its job
runs it — a full-suite run is the wrong instrument here.

Specs deliberately **not** admitted:

- `diag-event-page.spec.ts` — a diagnostic scaffold, not a test. Its only
  assertion is `body.length > 0`, which passes on a 500 error page. It exists to
  dump network logs and a screenshot while debugging selectors.
- `attendance.spec.ts`, `profile-edit.spec.ts` — these were never implemented.
  Every test in both is `test.fixme(...)` (4 each), sitting under a header block
  of `TODO (human, before un-fixme'ing)` steps: pick a stable seed event id,
  bake a `storageState` auth fixture, confirm the selectors. They report as
  "4 skipped" in any run. Retiring them changes nothing about what is tested;
  it only stops them being counted as an E2E suite that exists.
- `dancer-profile-attendance-ui-smoke.spec.ts` — fails in isolation under the
  smoke env (2 failed), and also failed in the nightly's real-secret run.

## One spec left in `tests/e2e/` that nothing runs

`vendor-city-real-supabase.spec.ts` stays in `tests/e2e/` but is **manual-only**.
It hard-skips without real credentials, and no workflow sets them — the nightly
was the last scheduled thing that even attempted it. It is kept because
`scripts/run-real-vendor-e2e.mjs` (`npm run test:e2e:vendor:real`) is its
deliberate entry point: run it by hand, with credentials, when touching the
vendor/city path. It is not attic'd because it is not retired — it is a tool, not
a gate. If that stops being true, attic it rather than leaving a spec that looks
scheduled and is not.

## Reviving one

If a spec here becomes viable again — most likely by being rewritten against
mocked client-only routes, or moved to `prod-smoke`'s real-site model — `git mv`
it back into `tests/e2e/`, run it individually under the smoke env first, and add
it explicitly to the `test:e2e` script in `package.json`. Do not widen
`test:e2e` to a glob: the explicit list is what keeps an unreviewed spec from
silently joining the PR gate.
