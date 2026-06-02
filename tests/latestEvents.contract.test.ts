/**
 * Contract test: get_latest_events_v2 - homepage "Recently added" feed
 *
 * Pins the public RPC that powers the LatestEventsWheel: anon-callable, capped
 * at the requested limit, ordered by created_at DESC (freshest first), gated to
 * still-attendable events (no clearly past-dated rows), each tagged
 * freshness_kind in {added, updated}, and carrying the fields the card renders.
 *
 * Resilient to the cross-repo deploy gap: the RPC is authored in the admin repo
 * and applied via `supabase db push`. Until that lands, the probe sees a
 * function-not-found error and the assertions soft-skip with a warning rather
 * than failing the suite. Once live, it enforces the contract.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(): { url?: string; key?: string } {
  const env: Record<string, string | undefined> = { ...process.env };
  if (fs.existsSync('.env')) {
    for (const raw of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).replace(/^"|"$/g, '');
      if (env[k] === undefined) env[k] = v;
    }
  }
  return {
    url: env.VITE_SUPABASE_URL ?? env.SUPABASE_URL,
    key:
      env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      env.SUPABASE_PUBLISHABLE_KEY ??
      env.SUPABASE_ANON_KEY,
  };
}

const { url, key } = loadEnv();
const haveCreds = Boolean(url && key);
const anon = haveCreds
  ? createClient(url as string, key as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const notDeployed = (e: { code?: string; message?: string } | null): boolean => {
  const m = `${e?.code ?? ''} ${e?.message ?? ''}`;
  return /PGRST202|Could not find the function|schema cache|does not exist/i.test(m);
};

const LIMIT = 6;

describe.skipIf(!haveCreds)('get_latest_events_v2 - contract', () => {
  let rows: Array<Record<string, unknown>> | null = null;
  let deployed = true;
  let probeError: { message?: string } | null = null;

  beforeAll(async () => {
    const { data, error } = await anon!.rpc('get_latest_events_v2' as never, {
      p_city_slug: null,
      p_limit: LIMIT,
    } as never);
    if (error) {
      if (notDeployed(error)) {
        deployed = false;
        console.warn(
          'get_latest_events_v2 not deployed yet - push admin migration ' +
            '20260806000000. Soft-skipping contract assertions.',
        );
        return;
      }
      probeError = error;
      return;
    }
    rows = data as Array<Record<string, unknown>>;
  });

  it('is anon-callable and returns at most the requested number of rows', () => {
    if (!deployed) return;
    expect(probeError, probeError?.message).toBeNull();
    expect(Array.isArray(rows)).toBe(true);
    expect((rows ?? []).length).toBeLessThanOrEqual(LIMIT);
  });

  it('is ordered by created_at DESC (freshest first)', () => {
    if (!deployed || !Array.isArray(rows)) return;
    for (let i = 1; i < rows.length; i++) {
      const prev = new Date(String(rows[i - 1].created_at)).getTime();
      const cur = new Date(String(rows[i].created_at)).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it('only surfaces still-attendable events (no clearly past-dated rows)', () => {
    if (!deployed || !Array.isArray(rows)) return;
    // 2-day grace absorbs city-tz vs UTC and the RPC's 6h "just finished" window.
    const cutoff = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    for (const r of rows) {
      if (r.instance_date) expect(String(r.instance_date) >= cutoff).toBe(true);
    }
  });

  it('tags each row freshness_kind in {added, updated}', () => {
    if (!deployed || !Array.isArray(rows)) return;
    for (const r of rows) {
      expect(['added', 'updated']).toContain(r.freshness_kind);
    }
  });

  it('each row carries the fields the wheel needs', () => {
    if (!deployed || !Array.isArray(rows) || rows.length === 0) return;
    for (const r of rows) {
      expect(typeof r.event_id).toBe('string');
      expect(typeof r.name).toBe('string');
      expect('created_at' in r).toBe(true);
      expect('freshness_kind' in r).toBe(true);
      expect('cover_image_url' in r).toBe(true);
      expect('location' in r).toBe(true);
      expect('instance_date' in r).toBe(true);
      expect(typeof r.has_class).toBe('boolean');
      expect(typeof r.has_party).toBe('boolean');
    }
  });

  it('respects the city filter (rows match the requested slug)', async () => {
    if (!deployed) return;
    const { data, error } = await anon!.rpc('get_latest_events_v2' as never, {
      p_city_slug: 'london-gb',
      p_limit: LIMIT,
    } as never);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    for (const r of (data as Array<Record<string, unknown>>) ?? []) {
      if (r.city_slug) expect(r.city_slug).toBe('london-gb');
    }
  });
});
