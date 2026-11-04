import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

// NOTE: nothing imports the setup module statically; a static import would run its side effect itself and hide a missing wiring.
const setup = () => import('../vitest.setup');
const REAL = { VITE_SUPABASE_URL: 'https://real.example.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'real-key' };

describe('vitest dummy Supabase env: wired under vitest only', () => {
  it('the setup file ran BEFORE this file: the env is defined and the real client loads (the gateRule/reviewRows failure)', async () => {
    expect(process.env.VITE_SUPABASE_URL).toBeTruthy();
    expect(process.env.VITE_SUPABASE_PUBLISHABLE_KEY).toBeTruthy();
    expect((await import('@/integrations/supabase/client')).supabase).toBeTruthy();
  });
  it('vitest.config.ts lists the setup file', () => expect(fs.readFileSync('vitest.config.ts', 'utf8')).toContain('vitest.setup.ts'));
  it.each(['vite.config.ts', 'playwright.config.ts', 'package.json'])('%s does not reference it (build, e2e and scripts keep the real env)', (f) =>
    expect(fs.readFileSync(f, 'utf8')).not.toContain('vitest.setup'));
  it('no workflow sets the dummy values', () => {
    for (const f of fs.readdirSync('.github/workflows')) expect(fs.readFileSync(`.github/workflows/${f}`, 'utf8')).not.toContain('dummy-vitest');
  });
});

describe('vitest dummy Supabase env: a real value always wins', () => {
  const fill = async (env: Record<string, unknown>, path = 'src/x.test.ts') => ((await setup()).fillDummySupabaseEnv(env, path), env);
  it('both real: untouched', async () => expect(await fill({ ...REAL })).toEqual(REAL));
  it('both missing: dummies', async () => expect(await fill({})).toEqual((await setup()).DUMMY_SUPABASE_ENV));
  it('one real, one missing: only the missing one is filled', async () =>
    expect(await fill({ VITE_SUPABASE_URL: REAL.VITE_SUPABASE_URL })).toEqual({ VITE_SUPABASE_URL: REAL.VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: (await setup()).DUMMY_SUPABASE_ENV.VITE_SUPABASE_PUBLISHABLE_KEY }));
  it('an EMPTY value is a real misconfiguration, not "missing": kept', async () => expect((await fill({ VITE_SUPABASE_URL: '' })).VITE_SUPABASE_URL).toBe(''));
  it.each(['tests/latestEvents.contract.test.ts', 'tests/eventViewCompat.contract.test.ts', 'a/b.contract.test.tsx'])('live-DB suite %s sees the env ABSENT', async (p) => {
    expect((await setup()).CONTRACT_TEST.test(p)).toBe(true);
    expect(await fill({}, p)).toEqual({});
  });
});
