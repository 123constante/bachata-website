import { describe, expect, it } from 'vitest';

describe('unit tests cannot reach live Supabase', () => {
  it.each([
    'https://stsdtacfauprzrdebmzg.supabase.co/rest/v1/rpc/record_auth_funnel_step_v1',
    'https://abc.supabase.co',
  ])('refuses %s', async (url) => {
    await expect(fetch(url, { method: 'POST' })).rejects.toThrow(/Blocked live Supabase request.*supabase\.co/);
  });
  it('refuses a Request object too', async () => {
    await expect(fetch(new Request('https://x.supabase.co/rest/v1/events'))).rejects.toThrow(/Blocked live Supabase/);
  });
  it('the real client is blocked end to end', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    // Same untyped call shape as src/lib/trackAuthStep.ts (the RPC is not in the generated types).
    const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, string>) => PromiseLike<{ error: unknown }>;
    const res = await rpc.call(supabase, 'record_auth_funnel_step_v1', { p_step: 'auth_view', p_outcome: 'ok' });
    expect(res.error).toBeTruthy();
  });
});
