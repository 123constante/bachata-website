// Unit tests — WhatsApp confirmation client helpers (src/lib/raffleWaVerify.ts).
// The supabase client is mocked: these lock the OUTCOME MAPPING, which is what
// keeps the dialog tolerant when the backend is dark.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
const rpcMock = vi.fn();

// Mocks the CANONICAL client module, not '@/lib/supabase' (which only
// re-exports it). raffleWaVerify now reaches the client through
// getSupabase() -> `await import('./client')`, so that is the module id the
// dynamic import resolves, and mocking the re-export would miss it entirely.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { sendWaConfirmation, pollWaVerifyStatus } from '../raffleWaVerify';

beforeEach(() => {
  invokeMock.mockReset();
  rpcMock.mockReset();
});

const noSleep = () => Promise.resolve();

describe('sendWaConfirmation', () => {
  it('maps a successful send to sent', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, wa_status: 'sent' }, error: null });
    expect(await sendWaConfirmation('e', 's')).toBe('sent');
  });

  it('maps skipped (infra dark) to skipped', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, wa_status: 'skipped' }, error: null });
    expect(await sendWaConfirmation('e', 's')).toBe('skipped');
  });

  it('maps a synchronous Meta failed verdict to failed', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, wa_status: 'failed' }, error: null });
    expect(await sendWaConfirmation('e', 's')).toBe('failed');
  });

  it('invoke error (function not deployed / network) → unavailable', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await sendWaConfirmation('e', 's')).toBe('unavailable');
  });

  it('invoke throw → unavailable (never propagates)', async () => {
    invokeMock.mockRejectedValue(new Error('offline'));
    expect(await sendWaConfirmation('e', 's')).toBe('unavailable');
  });

  it('not_claimable with settled sent/verified status → sent (poll resolves it)', async () => {
    invokeMock.mockResolvedValue({
      data: { ok: false, reason: 'not_claimable', wa_status: 'verified' },
      error: null,
    });
    expect(await sendWaConfirmation('e', 's')).toBe('sent');
  });

  it('unknown shapes → unavailable', async () => {
    invokeMock.mockResolvedValue({ data: { something: 'else' }, error: null });
    expect(await sendWaConfirmation('e', 's')).toBe('unavailable');
  });
});

describe('pollWaVerifyStatus', () => {
  const rpcSequence = (statuses: Array<{ found: boolean; wa_status?: string }>) => {
    for (const s of statuses) {
      rpcMock.mockResolvedValueOnce({ data: s, error: null });
    }
  };

  it('pending → sent → verified resolves verified', async () => {
    rpcSequence([
      { found: true, wa_status: 'pending' },
      { found: true, wa_status: 'sent' },
      { found: true, wa_status: 'verified' },
    ]);
    expect(await pollWaVerifyStatus('e', 's', { sleep: noSleep })).toBe('verified');
  });

  it('… → failed resolves failed', async () => {
    rpcSequence([
      { found: true, wa_status: 'sent' },
      { found: true, wa_status: 'failed' },
    ]);
    expect(await pollWaVerifyStatus('e', 's', { sleep: noSleep })).toBe('failed');
  });

  it('skipped resolves skipped (neutral, not an error)', async () => {
    rpcSequence([{ found: true, wa_status: 'skipped' }]);
    expect(await pollWaVerifyStatus('e', 's', { sleep: noSleep })).toBe('skipped');
  });

  it('RPC error → unavailable', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'nope' } });
    expect(await pollWaVerifyStatus('e', 's', { sleep: noSleep })).toBe('unavailable');
  });

  it('found:false (RPC missing pre-migration / wrong session) → unavailable', async () => {
    rpcMock.mockResolvedValue({ data: { found: false }, error: null });
    expect(await pollWaVerifyStatus('e', 's', { sleep: noSleep })).toBe('unavailable');
  });

  it('never settles within the deadline → timeout', async () => {
    rpcMock.mockResolvedValue({ data: { found: true, wa_status: 'sent' }, error: null });
    expect(await pollWaVerifyStatus('e', 's', { sleep: noSleep, maxWaitMs: 50, intervalMs: 1 })).toBe('timeout');
  });
});
