// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  bypassHeaders,
  getPreviewSha,
  assertMeasured,
  resolvePreviewUrl,
  probe,
  isPreviewHost,
  previewIsWalled,
} from '../scripts/lib/previewProbe.mjs';

const ENV_KEYS = ['CI', 'VERCEL_AUTOMATION_BYPASS_SECRET', 'GITHUB_SHA', 'GITHUB_EVENT_PATH', 'GITHUB_REPOSITORY', 'GITHUB_TOKEN'];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('bypassHeaders', () => {
  it('returns the bare bypass header when the secret is set (NO set-bypass-cookie: cookie-less fetch/curl clients would redirect-loop on the cookie-setting response a valid secret triggers)', () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 's3cr3t';
    expect(bypassHeaders()).toEqual({
      'x-vercel-protection-bypass': 's3cr3t',
    });
  });

  it('trims the secret (a trailing newline from `gh secret set < file` would make undici reject the header before any network I/O)', () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = ' s3cr3t\n';
    expect(bypassHeaders()).toEqual({
      'x-vercel-protection-bypass': 's3cr3t',
    });
  });

  it('treats a whitespace-only secret as absent', () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = '  \n';
    expect(bypassHeaders({ required: false })).toBeNull();
  });

  it('THROWS in CI when the secret is missing (never runs unauthenticated)', () => {
    process.env.CI = 'true';
    expect(() => bypassHeaders()).toThrow(/VERCEL_AUTOMATION_BYPASS_SECRET/);
  });

  it('returns null (not throw) locally, or when required:false', () => {
    expect(bypassHeaders()).toBeNull();
    process.env.CI = 'true';
    expect(bypassHeaders({ required: false })).toBeNull();
  });
});

describe('getPreviewSha', () => {
  it('prefers the PR head sha from the event payload over GITHUB_SHA', () => {
    process.env.GITHUB_SHA = 'mergecommitmergecommit';
    // Point at a temp event file.
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const p = path.join(os.tmpdir(), `evt-${Math.floor(process.hrtime()[1])}.json`);
    fs.writeFileSync(p, JSON.stringify({ pull_request: { head: { sha: 'prheadsha' } } }));
    process.env.GITHUB_EVENT_PATH = p;
    expect(getPreviewSha()).toBe('prheadsha');
    fs.unlinkSync(p);
  });

  it('falls back to GITHUB_SHA', () => {
    process.env.GITHUB_SHA = 'plainsha';
    expect(getPreviewSha()).toBe('plainsha');
  });
});

describe('assertMeasured', () => {
  it('passes when the count meets expectation', () => {
    expect(() => assertMeasured(3, 3, 'pages')).not.toThrow();
    expect(() => assertMeasured(4, 3)).not.toThrow();
  });
  it('THROWS on a shortfall (anti-masking)', () => {
    expect(() => assertMeasured(2, 3, 'pages')).toThrow(/measured 2\/3 pages/);
  });
});

describe('resolvePreviewUrl', () => {
  it('returns the environment_url of a ready Preview deployment', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('/deployments?')) {
        return { ok: true, json: async () => [{ id: 42, environment: 'Preview – site' }] } as Response;
      }
      if (url.includes('/deployments/42/statuses')) {
        return {
          ok: true,
          json: async () => [{ state: 'success', environment_url: 'https://x-abc.vercel.app/' }],
        } as Response;
      }
      throw new Error(`unexpected ${url}`);
    }));
    const url = await resolvePreviewUrl({
      sha: 'abc', token: 't', repo: 'o/r', log: () => {},
    });
    expect(url).toBe('https://x-abc.vercel.app'); // trailing slash stripped
    expect(calls[0]).toContain('/repos/o/r/deployments?sha=abc');
  });

  it('THROWS on timeout when no ready preview appears (fail-loud, never null)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] }) as Response));
    await expect(
      resolvePreviewUrl({ sha: 'abc', token: 't', repo: 'o/r', timeoutMs: 30, intervalMs: 5, log: () => {} }),
    ).rejects.toThrow(/no ready Vercel preview/);
  });
});

describe('probe', () => {
  it('THROWS on 401/403 (protection not bypassed)', async () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 's';
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 401 }) as Response));
    await expect(probe('https://x.vercel.app/')).rejects.toThrow(/HTTP 401/);
  });

  it('returns the response on success and injects the bypass headers', async () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 's';
    const seen: Record<string, string> = {};
    vi.stubGlobal('fetch', vi.fn(async (_url: string, opts: RequestInit) => {
      Object.assign(seen, opts.headers);
      return { status: 200, ok: true } as Response;
    }));
    const res = await probe('https://x.vercel.app/');
    expect(res.status).toBe(200);
    expect(seen['x-vercel-protection-bypass']).toBe('s');
  });
});

describe('isPreviewHost', () => {
  it('true for *.vercel.app, false for prod and garbage', () => {
    expect(isPreviewHost('https://site-abc123.vercel.app')).toBe(true);
    expect(isPreviewHost('https://www.bachatacalendar.co.uk')).toBe(false);
    expect(isPreviewHost('not a url')).toBe(false);
  });
});

// Wall detection is POSITIVE-only: walled means proven (401/403, or the redirect
// chain parked on Vercel's login/sso surface). A throw (timeout, DNS, redirect
// loop, broken preview) is NOT walled — the real check must run and fail loud.
describe('previewIsWalled', () => {
  const resp = (status: number, url: string) =>
    ({ status, url, body: { cancel: vi.fn(async () => {}) } }) as unknown as Response;

  it('walled: redirect chain parked on vercel.com/login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resp(200, 'https://vercel.com/login?next=%2Fsso-api')));
    expect(await previewIsWalled('https://x-abc.vercel.app')).toBe(true);
  });

  it('walled: direct 401/403 on the preview host (Password Protection mode)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resp(401, 'https://x-abc.vercel.app/')));
    expect(await previewIsWalled('https://x-abc.vercel.app')).toBe(true);
    vi.stubGlobal('fetch', vi.fn(async () => resp(403, 'https://x-abc.vercel.app/')));
    expect(await previewIsWalled('https://x-abc.vercel.app')).toBe(true);
  });

  it('NOT walled: healthy 200 on the preview host', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resp(200, 'https://x-abc.vercel.app/city/london-gb')));
    expect(await previewIsWalled('https://x-abc.vercel.app')).toBe(false);
  });

  it('NOT walled: a site URL merely containing /sso-api is not the wall (host-anchored match)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resp(200, 'https://x-abc.vercel.app/docs/sso-api-integration')));
    expect(await previewIsWalled('https://x-abc.vercel.app')).toBe(false);
  });

  it('NOT walled: a fetch throw (timeout/DNS/redirect loop) must let the real check fail loud', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));
    expect(await previewIsWalled('https://x-abc.vercel.app')).toBe(false);
  });

  it('cancels the response body (an unconsumed undici body keeps the event loop alive)', async () => {
    const cancel = vi.fn(async () => {});
    vi.stubGlobal('fetch', vi.fn(async () =>
      ({ status: 200, url: 'https://x-abc.vercel.app/', body: { cancel } }) as unknown as Response));
    await previewIsWalled('https://x-abc.vercel.app');
    expect(cancel).toHaveBeenCalled();
  });
});
