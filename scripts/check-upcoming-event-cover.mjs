/**
 * CI contract check #62 -- upcoming events carry a cover image (2026-08-03).
 *
 * NO SHEBANG, deliberately -- tests/upcomingEventCover.test.ts imports this
 * module, and vitest compiles an imported file through vm.Script, which does NOT
 * strip a shebang the way Node's own module loader does. It fails with a bare
 * "SyntaxError: Invalid or unexpected token" pointing at line 2, nowhere near the
 * real cause. check-image-widths.mjs carries the same note for the same reason;
 * this file re-learned it the hard way on the day it was written. Every caller
 * runs it as `node scripts/check-upcoming-event-cover.mjs`.
 *
 * Asserts that every UPCOMING, slugged event a reader can reach has a non-null
 * cover_image_url. A coverless event is not a broken page -- it renders fine --
 * but its link preview silently degrades to the generic site logo, which is the
 * one failure nobody sees until someone shares the link.
 *
 * WHY: on 2026-08-03 the OG guard reddened on /event/mambo-city-x-llb, whose
 * og:image had fallen back to og-image.jpg. Two things came out of diagnosing it.
 * The event was PAST (2026-05-09) so nothing shareable was affected, and the OG
 * guard now scopes finished events to warnings. But the underlying condition --
 * app/detailLoader.ts:resolveOgCardImage() returns the static fallback whenever
 * the cover token is null -- is invisible until it lands on an event someone is
 * about to share. This check moves the detection to the DATA layer, where it can
 * fire while the event is still upcoming and the organiser can still fix it.
 *
 * SCOPED TO UPCOMING ON PURPOSE, and that is the whole point of the check: a past
 * event with no cover breaks no live journey (the same reasoning CI check #65
 * applies to dead image refs on archived rows, and the same reasoning that keeps
 * og-preview green on exactly this row). Redding CI over last May's flyer is the
 * alarm fatigue this arc exists to drain.
 *
 * NO NEW RPC: it reads get_calendar_events_v2, which is already anon-callable and
 * already returns slug + cover_image_url, so this check is self-contained in the
 * Website repo. Migration authority stays in admin precisely because nothing here
 * needs it.
 *
 * Local:  node scripts/check-upcoming-event-cover.mjs
 * CI:     same, env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// How far ahead to look, BOUNDED BY POSTGREST'S ROW CAP rather than by taste.
// The RPC comes back through PostgREST, which truncates at 1000 rows and says
// nothing about it: a 365-day window measured 1445 rows in SQL and returned
// exactly 1000 here, so the first draft of this check silently skipped a third
// of the horizon while printing "all covered". Measured 2026-08-03 across 4
// cities: 90d=382, 120d=502, 180d=735, 365d=1445. 180 leaves ~25% headroom under
// the cap and still covers every live festival occurrence bar the far tail.
// If the site grows past it, ROW_CAP below reds rather than quietly narrowing.
const HORIZON_DAYS = 180;
// PostgREST's default max-rows. Hitting it exactly means the result was
// truncated, so the scan no longer covers the window it claims to.
const ROW_CAP = 1000;
// A scan that measured nothing is not a pass. The live figure is ~1445; this is a
// "the RPC clearly worked" floor, deliberately far below it so a quiet season
// cannot red the build.
const MIN_ROWS = 50;

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    for (const raw of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).replace(/^"|"$/g, '');
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

const iso = (d) => d.toISOString().slice(0, 10);

/** The contract as one decision, so a caller can drive it without the CLI. */
export function findBreaches(rows) {
  return rows
    .filter((r) => r && r.slug && !r.cover_image_url)
    .map((r) => ({
      slug: r.slug,
      name: r.name ?? '(unnamed)',
      date: r.instance_date ?? r.start_time ?? '(undated)',
      eventId: r.event_id ?? null,
    }));
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const from = new Date();
  const to = new Date(from.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

  // p_include_past=false is what makes this upcoming-only; city null = every city.
  const { data, error } = await sb.rpc('get_calendar_events_v2', {
    range_start: iso(from),
    range_end: iso(to),
    city_slug_param: null,
    p_include_past: false,
  });
  if (error) {
    console.error(`FAIL: get_calendar_events_v2 errored: ${error.message}`);
    return 1;
  }

  const rows = data ?? [];
  if (rows.length < MIN_ROWS) {
    console.error(
      `FAIL: get_calendar_events_v2 returned ${rows.length} upcoming rows (floor ${MIN_ROWS}). ` +
        'The site has upcoming events, so this means the RPC or its predicates are broken -- ' +
        'a scan that measured nothing must not pass as green.',
    );
    return 1;
  }

  // TRUNCATION TRIPWIRE. PostgREST caps the result silently, so a full page is
  // indistinguishable from a complete one -- and a check that stops looking
  // partway while reporting "all covered" is the exact dead-check shape this
  // repo kills. Shrink HORIZON_DAYS (or paginate) when this fires.
  if (rows.length >= ROW_CAP) {
    console.error(
      `FAIL: got ${rows.length} rows, at or above PostgREST's ${ROW_CAP}-row cap, so the ` +
        `${HORIZON_DAYS}-day window was TRUNCATED and the tail went unchecked. ` +
        'Lower HORIZON_DAYS or paginate -- do not read this as a pass.',
    );
    return 1;
  }

  const breaches = findBreaches(rows);
  if (breaches.length > 0) {
    console.error(`FAIL: ${breaches.length} upcoming slugged event(s) have no cover image.`);
    console.error('Their link previews fall back to the generic site logo (og-image.jpg).');
    for (const b of breaches) {
      console.error(`  x /event/${b.slug}  ${b.date}  ${b.name}${b.eventId ? `  [${b.eventId}]` : ''}`);
    }
    console.error('\nFix: set the event cover in admin. See app/detailLoader.ts:resolveOgCardImage().');
    return 1;
  }

  console.log(
    `Upcoming-event cover contract: ok (${rows.length} upcoming row(s) over ${HORIZON_DAYS}d, all covered).`,
  );
  return 0;
}

// Only act when run as the CLI. Importing this module (the spec does, to reach
// findBreaches) must not fire a live RPC call -- an import side effect puts a
// network round-trip inside unit-tests.yml, which has no Supabase secrets, and
// makes the fast pure tests depend on prod being up. Observed for real while
// writing this: before the guard, `vitest run` on the spec went green having
// silently called the RPC.
//
// The separator is spelled by char code, not written literally, because the
// surrounding tooling halves doubled backslashes in transit -- a literal
// /BACKSLASH BACKSLASH/g arrived as an unterminated regex and the write was
// refused by its own parse check.
//
// process.exitCode, never process.exit(): a bare exit discards in-flight stdio
// writes and aborts under libuv on Windows (measured on check-og-images.mjs the
// same day -- exit 127 with an assertion instead of the real message).
const BACKSLASH = String.fromCharCode(92);
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  process.argv[1].split(BACKSLASH).join('/').endsWith('check-upcoming-event-cover.mjs');

/**
 * R4 canary: prove this guard can FAIL, in both directions, without a network.
 *
 * tests/upcomingEventCover.test.ts already drives findBreaches() thoroughly, but
 * a spec in a separate file is not reachable from the script, so rule R4 (check
 * #63) cannot see it and -- more to the point -- neither can anyone running this
 * guard. The thresholds below are the ones nothing else asserts: MIN_ROWS and
 * ROW_CAP are what stop this check reporting green off a sample it never really
 * measured, which is the failure mode the whole surrounding arc exists to end.
 *
 * Expectations are named EXPLICITLY rather than derived from the constants, per
 * the rule earned on #189: a spec that reads its expectation from the code under
 * test goes quiet at the same moment the code does.
 */
export function selfTest(log = console.log) {
  const cases = [];
  let failed = 0;
  const add = (name, actual, expected) => cases.push({ name, actual, expected });

  const covered = { slug: 'a', cover_image_url: 'https://x/y.jpg', instance_date: '2026-09-01', name: 'A' };
  const bare = { slug: 'b', cover_image_url: null, instance_date: '2026-09-01', name: 'B' };

  // --- findBreaches, both directions ---
  add('a covered slugged event is not a breach', findBreaches([covered]).length, 0);
  add('a null cover on a slugged event IS a breach', findBreaches([bare]).length, 1);
  add('an empty-string cover counts as missing', findBreaches([{ ...bare, cover_image_url: '' }]).length, 1);
  add('an unslugged row is ignored (no shareable URL)', findBreaches([{ ...bare, slug: null }]).length, 0);
  add('every breach is reported, not just the first', findBreaches([bare, { ...bare, slug: 'c' }]).length, 2);
  add('the breach names its slug', findBreaches([bare])[0].slug, 'b');
  add('a malformed row does not throw mid-scan', findBreaches([null, undefined, {}, bare]).length, 1);

  // --- the thresholds that stop a green off an unmeasured sample. These are the
  // reason this guard does not inherit the check-sourcemap-debugids.mjs defect:
  // an empty result is a FAILURE here, never a skip. ---
  // Named literals, not comparisons against the constants themselves: `ROW_CAP
  // <= ROW_CAP` is a tautology that cannot fail, and a case that cannot fail is
  // exactly what R4 exists to stop. Changing either constant reds these.
  add('MIN_ROWS is the measured floor (50), so an empty sample fails', MIN_ROWS, 50);
  add('ROW_CAP is PostgREST\'s page limit (1000)', ROW_CAP, 1000);
  add('the floor sits under the cap', MIN_ROWS < ROW_CAP, true);

  for (const c of cases) {
    const ok = c.actual === c.expected;
    if (!ok) failed++;
    log(`${ok ? '  ok  ' : '  FAIL'} ${c.name}${ok ? '' : ` (got ${JSON.stringify(c.actual)}, want ${JSON.stringify(c.expected)})`}`);
  }
  log('');
  log(
    failed === 0
      ? `PASS self-test -- ${cases.length} cases, the contract proven in both directions.`
      : `FAIL self-test -- ${failed} of ${cases.length} case(s).`,
  );
  return failed === 0;
}

if (invokedDirectly) {
  process.exitCode = process.argv.includes('--self-test') ? (selfTest() ? 0 : 1) : await main();
}
