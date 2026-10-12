import { describe, expect, it, vi } from 'vitest';
import {
  createReporter,
  describeError,
  shouldIgnore,
  MAX_REPORTS_PER_LOAD,
  MAX_MESSAGE_CHARS,
  type ClientErrorReport,
  type ReporterDeps,
} from './clientErrorReporter';
import runDefault from './clientErrorReporter';

function harness(overrides: Partial<ReporterDeps> = {}) {
  const sent: ClientErrorReport[] = [];
  const deps: ReporterDeps = {
    send: (r) => {
      sent.push(r);
    },
    enabled: () => true,
    pathname: () => '/event/abc',
    release: 'deadbeef',
    ...overrides,
  };
  return { sent, reporter: createReporter(deps) };
}

const typeError = (message: string) => new TypeError(message);
const named = (name: string, message: string) => Object.assign(new Error(message), { name });

// Built from the failure shapes this site's own code and supabase-js produce,
// plus the browser-noise classes every public site sees (the old Sentry issue
// titles are not in this repo, so they could not be used).
describe('noise filter', () => {
  const cases: Array<[string, unknown, string | undefined, boolean]> = [
    ['ResizeObserver loop (Chrome)', new Error('ResizeObserver loop limit exceeded'), undefined, true],
    ['ResizeObserver loop (Safari/FF)', new Error('ResizeObserver loop completed with undelivered notifications.'), undefined, true],
    ['cross-origin Script error.', { message: 'Script error.' }, '', true],
    ['window error with no message at all', { message: '' }, '', true],
    ['chrome extension in filename', new Error('x is not defined'), 'chrome-extension://abc/content.js', true],
    ['moz extension in message', new Error('Error in moz-extension://abc/inject.js'), undefined, true],
    ['extension only in stack', Object.assign(new Error('boom'), { stack: 'Error: boom\n at chrome-extension://abc/x.js:1:1' }), undefined, true],
    ['AbortError', named('AbortError', 'The user aborted a request.'), undefined, true],
    ['offline Chrome', typeError('Failed to fetch'), undefined, true],
    ['offline Safari', typeError('Load failed'), undefined, true],
    ['offline Firefox', typeError('NetworkError when attempting to fetch resource.'), undefined, true],
    ['offline via supabase-js (plain object)', { message: 'TypeError: Failed to fetch' }, undefined, true],
    ['real TypeError in our code', typeError("Cannot read properties of undefined (reading 'slug')"), undefined, false],
    ['PostgREST permission error (plain object)', { message: 'permission denied for table dancer_profiles', code: '42501' }, undefined, false],
    ['MissingDancerProfileError', named('MissingDancerProfileError', 'Your dancer profile has not been set up yet.'), undefined, false],
    ['5xx route error response', { status: 500, statusText: 'Internal Server Error', data: 'x' }, undefined, false],
    ['string rejection reason', 'boom', undefined, false],
    ['a message merely containing "fetch"', new Error('Failed to fetch dynamically imported module: /assets/x.js'), undefined, false],
    ['our own script file', new Error('x is not defined'), 'https://bachatacalendar.com/assets/root-abc.js', false],
  ];
  it.each(cases)('%s', (_label, input, filename, ignored) => {
    expect(shouldIgnore(input, filename)).toBe(ignored);
    const { sent, reporter } = harness();
    reporter.report('error', input, { filename });
    expect(sent.length).toBe(ignored ? 0 : 1);
  });
});

describe('per-page-load caps', () => {
  it('sends each fingerprint once', () => {
    const { sent, reporter } = harness();
    for (let i = 0; i < 4; i++) reporter.report('render', new Error('Boom'));
    expect(sent).toHaveLength(1);
  });

  it('treats digit- and uuid-only differences as the same fingerprint', () => {
    const { sent, reporter } = harness();
    reporter.report('error', new Error('row 12 failed'));
    reporter.report('error', new Error('row 13 failed'));
    reporter.report('error', new Error('id 3f1c2a9e-1b2c-4d5e-8f90-0123456789ab missing'));
    reporter.report('error', new Error('id 00000000-1111-4222-8333-444444444444 missing'));
    expect(sent).toHaveLength(2);
  });

  it('keeps kinds and routes apart', () => {
    let path = '/a';
    const { sent, reporter } = harness({ pathname: () => path });
    reporter.report('render', new Error('Boom'));
    reporter.report('save_failed', new Error('Boom'));
    path = '/b';
    reporter.report('render', new Error('Boom'));
    expect(sent.map((r) => [r.p_kind, r.p_route])).toEqual([
      ['render', '/a'],
      ['save_failed', '/a'],
      ['render', '/b'],
    ]);
  });

  it(`stops after ${MAX_REPORTS_PER_LOAD} reports in total`, () => {
    const { sent, reporter } = harness();
    for (let i = 0; i < 20; i++) reporter.report('error', new Error(`distinct failure ${'x'.repeat(i)}`));
    expect(sent).toHaveLength(MAX_REPORTS_PER_LOAD);
  });

  it('ignored errors do not use up the cap', () => {
    const { sent, reporter } = harness();
    for (let i = 0; i < 20; i++) reporter.report('error', typeError('Failed to fetch'));
    reporter.report('error', new Error('real'));
    expect(sent).toHaveLength(1);
  });

  it('fingerprint is short and stable', () => {
    const a = harness();
    const b = harness();
    a.reporter.report('render', new Error('Boom'));
    b.reporter.report('render', new Error('Boom'));
    expect(a.sent[0].p_fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(a.sent[0].p_fingerprint).toBe(b.sent[0].p_fingerprint);
  });
});

describe('scrubbing and truncation', () => {
  const cases: Array<[string, unknown, string]> = [
    ['name + first line only, no stack', Object.assign(new TypeError('bad thing\nsecond line with secrets'), { stack: 'TypeError: bad thing\n at f (x.js:1:1)' }), 'TypeError: bad thing'],
    ['email', new Error('no account for maria.lopez+1@example.co.uk here'), 'Error: no account for <email> here'],
    ['uuid', new Error('profile 3f1c2a9e-1b2c-4d5e-8f90-0123456789ab missing'), 'Error: profile <uuid> missing'],
    ['JWT', new Error('bad token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc_DEF-123'), 'Error: bad token <token>'],
    ['query string on a URL', new Error('GET https://x.supabase.co/rest/v1/people?email=eq.a@b.com&select=* 400'), 'Error: GET https://x.supabase.co/rest/v1/people 400'],
    ['long digit run (phone)', new Error('whatsapp 447700900123 invalid'), 'Error: whatsapp <n> invalid'],
    ['postgres echoed input', { message: 'invalid input syntax for type integer: "Maria Lopez"' }, 'invalid input syntax for type integer: "<value>"'],
    ['constraint name kept', { message: 'new row for relation "dancer_profiles" violates check constraint "x"' }, 'new row for relation "dancer_profiles" violates check constraint "x"'],
    ['5xx route response', { status: 503, statusText: 'Service Unavailable', data: { user: 'secret' } }, 'RouteErrorResponse: 503 Service Unavailable'],
    ['JS syntax token kept', new SyntaxError("Unexpected token '?'"), "SyntaxError: Unexpected token '?'"],
  ];
  it.each(cases)('%s', (_label, input, expected) => {
    expect(describeError(input)).toBe(expected);
  });

  it(`truncates the message to ${MAX_MESSAGE_CHARS} chars`, () => {
    expect(describeError(new Error('a'.repeat(1000)))).toHaveLength(MAX_MESSAGE_CHARS);
  });

  it('sends the path only: no query, no fragment, ids masked', () => {
    const { sent, reporter } = harness({
      pathname: () => '/profile/3f1c2a9e-1b2c-4d5e-8f90-0123456789ab/edit?email=a@b.com#frag',
    });
    reporter.report('render', new Error('Boom'));
    expect(sent[0].p_route).toBe('/profile/<uuid>/edit');
  });

  it('sends exactly the RPC contract keys', () => {
    const { sent, reporter } = harness({ release: 'x'.repeat(100) });
    reporter.report('save_failed', new Error('Boom'));
    expect(Object.keys(sent[0]).sort()).toEqual(['p_fingerprint', 'p_kind', 'p_message', 'p_release', 'p_route']);
    expect(sent[0].p_release).toHaveLength(64);
  });
});

describe('gates', () => {
  it('sends nothing when disabled (dev/test build or Do Not Track)', () => {
    const { sent, reporter } = harness({ enabled: () => false });
    reporter.report('render', new Error('Boom'));
    expect(sent).toHaveLength(0);
  });

  it('the real module is disabled under vitest (import.meta.env.DEV)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      runDefault(new Error('Boom'), 'render');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('never throws', () => {
  const hostile: Array<[string, Partial<ReporterDeps>]> = [
    ['send throws synchronously', { send: () => { throw new Error('send'); } }],
    ['send rejects', { send: () => Promise.reject(new Error('rpc')) }],
    ['pathname throws', { pathname: () => { throw new Error('location'); } }],
    ['enabled throws', { enabled: () => { throw new Error('navigator'); } }],
  ];
  it.each(hostile)('%s', async (_label, deps) => {
    const { reporter } = harness(deps);
    expect(() => reporter.report('render', new Error('Boom'))).not.toThrow();
    // A rejected send must be handled, not surface as an unhandled rejection.
    await new Promise((r) => setTimeout(r, 0));
  });

  it('survives hostile error values', () => {
    const { reporter } = harness();
    const getterBomb = Object.defineProperty({}, 'message', { get() { throw new Error('getter'); } });
    for (const value of [undefined, null, 0, Symbol('s'), getterBomb, Object.create(null)]) {
      expect(() => reporter.report('error', value)).not.toThrow();
    }
  });

  it('installs window handlers once and routes events to the right kind', () => {
    const handlers: Record<string, Array<(ev: unknown) => void>> = {};
    const target = { addEventListener: (type: string, fn: (ev: unknown) => void) => { (handlers[type] ??= []).push(fn); } };
    const { sent, reporter } = harness();
    reporter.install(target as unknown as Window);
    reporter.install(target as unknown as Window);
    expect(handlers.error).toHaveLength(1);
    expect(handlers.unhandledrejection).toHaveLength(1);
    handlers.error[0]({ error: new Error('window boom'), filename: 'https://site/assets/a.js' });
    handlers.unhandledrejection[0]({ reason: new Error('async boom') });
    expect(sent.map((r) => r.p_kind)).toEqual(['error', 'unhandledrejection']);
  });
});
