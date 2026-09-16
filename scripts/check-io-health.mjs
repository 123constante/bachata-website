#!/usr/bin/env node
/**
 * IO HEALTH POLL -- Phase 6 Step 2 of the Supabase IO Optimization arc (see
 * ~/.claude/plans/phase-6-io-health-check-auto-degradation.md). CI-only
 * consumer of /api/io-health: polls the deployed endpoint and reports the
 * raw candidate series it returns. Nothing here computes a threshold or
 * degrades app behaviour -- that is Step 3, deliberately out of scope and
 * reviewed separately.
 *
 * Local:  IO_HEALTH_SECRET=<secret> node scripts/check-io-health.mjs
 *         node scripts/check-io-health.mjs --self-test
 * CI:     .github/workflows/io-health-guard.yml (schedule + workflow_dispatch)
 *
 * Exit: 0 the endpoint answered with a series list, 1 never used (this check
 * has no pass/fail threshold yet -- see the plan), 2 the guard could not
 * measure (missing secret, unreachable site, malformed response, empty
 * series list). A missing IO_HEALTH_SECRET is exit 2, never a green report
 * over an unauthenticated call that was never made.
 */
import { isEntryPoint } from './lib/entry-point.mjs';

const DEFAULT_BASE = 'https://www.bachatacalendar.co.uk';

export class CannotMeasure extends Error {}
const cannot = (msg) => {
  throw new CannotMeasure(msg);
};

export function assertHealthBody(body) {
  if (!body || typeof body !== 'object') {
    cannot('the response body did not parse to an object.');
  }
  if (body.ok !== true) {
    cannot('the endpoint reported ok=false: ' + JSON.stringify(body.reason ?? body));
  }
  if (!Array.isArray(body.series)) {
    cannot('the response has no series array.');
  }
  if (body.series.length === 0) {
    cannot(
      'the series array is empty. Either the metrics scrape returned none of ' +
        'the candidate series names, or the endpoint is misconfigured -- an ' +
        'empty list reads as nothing to report and must not pass as healthy.',
    );
  }
  for (const row of body.series) {
    if (typeof row?.metric !== 'string' || typeof row?.value !== 'number' ||
        !Number.isFinite(row.value)) {
      cannot('a series row is malformed: ' + JSON.stringify(row));
    }
  }
  return body;
}

export async function pollIoHealth({ baseUrl, secret, fetchImpl = fetch, timeoutMs = 15000 }) {
  if (!secret) {
    cannot('IO_HEALTH_SECRET is not set. A missing secret is exit 2, never an ' +
      'unauthenticated call that happens to read as fine.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(baseUrl.replace(/\/$/, '') + '/api/io-health', {
      headers: { authorization: 'Bearer ' + secret },
      signal: controller.signal,
    });
  } catch (error) {
    cannot(
      'could not reach ' + baseUrl + '/api/io-health: ' + error.message +
        (error.name === 'AbortError' ? ' (timed out after ' + timeoutMs + 'ms)' : ''),
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    cannot('GET /api/io-health -> HTTP ' + res.status);
  }
  let body;
  try {
    body = await res.json();
  } catch {
    cannot('GET /api/io-health returned a body that did not parse as JSON.');
  }
  return assertHealthBody(body);
}

export async function runCheck({ baseUrl, secret, api = pollIoHealth, log = console.log }) {
  const body = await api({ baseUrl, secret });
  log('IO health poll -- ' + baseUrl + '/api/io-health (scraped_at ' + body.scraped_at + ')');
  for (const row of body.series) {
    log('  ' + row.metric + (row.labels || '') + ' = ' + row.value);
  }
  return { code: 0, series: body.series };
}

// ---------------------------------------------------------------------------
// Canary (R4/R5 of check-script-conventions.mjs). Every failure path is
// proven from fixtures -- no network, no secret.
// ---------------------------------------------------------------------------

function makeFixtureFetch(spec) {
  return async () => {
    if (spec.networkError) throw new Error(spec.networkError);
    return {
      ok: spec.status === undefined || spec.status < 400,
      status: spec.status ?? 200,
      json: async () => {
        if (spec.badJson) throw new Error('unexpected token');
        return spec.body;
      },
    };
  };
}

function selfTest() {
  const cases = [];
  const add = (name, run, expected) => cases.push({ name, run, expected });

  const KINDS = [
    ['IO_HEALTH_SECRET is not set', 'missing-secret'],
    ['could not reach', 'unreachable'],
    ['timed out', 'timeout'],
    ['HTTP ', 'http-error'],
    ['did not parse as JSON', 'bad-json'],
    ['did not parse to an object', 'bad-body'],
    ['reported ok=false', 'ok-false'],
    ['no series array', 'no-series'],
    ['series array is empty', 'empty-series'],
    ['series row is malformed', 'bad-row'],
  ];
  const classify = (error) => {
    for (const [needle, kind] of KINDS) {
      if (String(error.message).includes(needle)) return kind;
    }
    return 'unclassified: ' + String(error.message).slice(0, 90);
  };

  // Drives main() itself, not just runCheck() -- R5 requires proving the
  // FUNCTION THAT OWNS process.exitCode is reachable from the canary, not
  // merely a helper it calls. A code path that returns before main() ever
  // runs would satisfy a weaker canary while leaving the CLI's actual exit
  // wiring unproven.
  const outcome = async (spec, secret = 's3cret') => {
    const code = await main([], {
      baseUrl: 'https://example.test',
      secret,
      api: (args) => pollIoHealth({ ...args, fetchImpl: makeFixtureFetch(spec) }),
      log: () => {},
      err: () => {},
    });
    if (code === 0) return 'ok';
    return 'exit-' + code;
  };
  const outcomeError = async (spec, secret = 's3cret') => {
    try {
      const result = await runCheck({
        baseUrl: 'https://example.test',
        secret,
        api: (args) => pollIoHealth({ ...args, fetchImpl: makeFixtureFetch(spec) }),
        log: () => {},
      });
      return result.code === 0 ? 'ok' : 'unexpected-code-' + result.code;
    } catch (error) {
      return classify(error);
    }
  };

  const goodBody = {
    ok: true,
    scraped_at: '2026-09-16T00:00:00Z',
    series: [{ metric: 'pg_stat_database_blks_read', labels: '', value: 42 }],
  };

  // These two drive main() itself (THE EXIT-CODE CONTRACT ITSELF), proving the
  // value process.exitCode is assigned from is reachable and correct in both
  // directions -- not just that runCheck()/pollIoHealth() can be made to throw.
  add('main(): a healthy scrape exits 0', () => outcome({ status: 200, body: goodBody }), 'ok');
  add(
    'main(): a missing secret exits 2, never an unauthenticated call',
    () => outcome({ status: 200, body: goodBody }, ''),
    'exit-2',
  );

  add('a healthy scrape passes', () => outcomeError({ status: 200, body: goodBody }), 'ok');
  add(
    'a missing secret is exit 2, never an unauthenticated call',
    () => outcomeError({ status: 200, body: goodBody }, ''),
    'missing-secret',
  );
  add(
    'a network failure is exit 2, not a swallowed error',
    () => outcomeError({ networkError: 'fetch failed' }),
    'unreachable',
  );
  add('a non-2xx status is exit 2', () => outcomeError({ status: 401, body: {} }), 'http-error');
  add('an unparseable body is exit 2', () => outcomeError({ status: 200, badJson: true }), 'bad-json');
  add('ok=false in the body is exit 2, not read as healthy', () =>
    outcomeError({ status: 200, body: { ok: false, reason: 'misconfigured' } }), 'ok-false');
  add('a body with no series array is exit 2', () =>
    outcomeError({ status: 200, body: { ok: true } }), 'no-series');
  add(
    'an EMPTY series array is exit 2, never read as a healthy account',
    () => outcomeError({ status: 200, body: { ok: true, series: [] } }),
    'empty-series',
  );
  add(
    'a malformed series row is exit 2',
    () => outcomeError({ status: 200, body: { ok: true, series: [{ metric: 'x' }] } }),
    'bad-row',
  );
  add(
    'assertHealthBody is the function that actually owns the throw (R5)',
    () => {
      try {
        assertHealthBody({ ok: true, series: [] });
        return 'did-not-throw';
      } catch (error) {
        return classify(error);
      }
    },
    'empty-series',
  );

  let pass = 0;
  const failures = [];
  return Promise.all(cases.map(async (c) => {
    const actual = await c.run();
    if (actual === c.expected) {
      pass += 1;
    } else {
      failures.push(c.name + ': expected ' + JSON.stringify(c.expected) + ', got ' + JSON.stringify(actual));
    }
  })).then(() => {
    console.log('check-io-health self-test: ' + pass + '/' + cases.length + ' passed');
    for (const f of failures) console.error('  FAIL: ' + f);
    return failures.length === 0 ? 0 : 2;
  });
}

async function main(argv, deps = {}) {
  if (argv.includes('--self-test')) {
    return selfTest();
  }
  const baseUrl = deps.baseUrl ?? process.env.IO_HEALTH_BASE_URL ?? DEFAULT_BASE;
  const secret = deps.secret ?? process.env.IO_HEALTH_SECRET ?? '';
  const api = deps.api ?? pollIoHealth;
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  try {
    await runCheck({ baseUrl, secret, api, log });
    return 0;
  } catch (error) {
    err('check-io-health: ' + error.message);
    return 2;
  }
}

if (isEntryPoint(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
