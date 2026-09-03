import { describe, it, expect, vi, afterEach } from 'vitest';

// Restore in a hook, not at the end of each body. A trailing mockRestore() is
// skipped when an assertion above it throws, which leaves process.exit a no-op
// and console.error silenced for every later test in the file -- so a second,
// genuine failure reports as a confusing pass-through. Found at review.
afterEach(() => vi.restoreAllMocks());
import {
  isTransient, rpcWithRetry, rpcOnce, exitTransient, RpcError, TRANSIENT_CODES,
} from '../scripts/lib/rpc-retry.mjs';

// A stub client whose rpc() replays a scripted sequence of Supabase-shaped
// results. Counting calls is the whole point: "did it retry" is not observable
// from the return value.
function stubClient(sequence) {
  const calls = [];
  return {
    calls,
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      const next = sequence[Math.min(calls.length - 1, sequence.length - 1)];
      return typeof next === 'function' ? next() : next;
    },
  };
}

const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };
const contractError = { code: '42883', message: 'function public.nope(unknown) does not exist' };
const noSleep = async () => {};

describe('isTransient', () => {
  it('classifies every listed SQLSTATE by code', () => {
    for (const code of TRANSIENT_CODES) expect(isTransient({ code, message: 'x' })).toBe(true);
  });

  it('classifies a transport failure that carries no SQLSTATE', () => {
    expect(isTransient(new Error('fetch failed'))).toBe(true);
    expect(isTransient({ message: 'ETIMEDOUT' })).toBe(true);
  });

  // The direction that matters: a real defect must never be read as infrastructure.
  it('does NOT classify a genuine contract error', () => {
    expect(isTransient(contractError)).toBe(false);
    expect(isTransient({ message: '3 rows drifted from their typed columns' })).toBe(false);
    expect(isTransient(null)).toBe(false);
  });

  // The overlap case, and why a bare 'network' was removed from the phrase
  // list: an object NAME must never make a real failure look like infrastructure.
  it('does NOT classify a contract error whose message merely contains a matched word', () => {
    expect(isTransient({ code: '42501', message: 'permission denied for table social_network_links' }))
      .toBe(false);
    expect(isTransient({ message: 'column events.network_id does not exist' })).toBe(false);
  });
});

describe('rpcWithRetry', () => {
  it('retries a transient failure and returns the eventual success', async () => {
    const sb = stubClient([{ data: null, error: timeout }, { data: { ok: 1 }, error: null }]);
    await expect(rpcWithRetry(sb, 'f', {}, { sleep: noSleep })).resolves.toEqual({ ok: 1 });
    expect(sb.calls).toHaveLength(2);
  });

  it('does NOT retry a non-transient failure', async () => {
    const sb = stubClient([{ data: null, error: contractError }]);
    await expect(rpcWithRetry(sb, 'f', {}, { sleep: noSleep })).rejects.toMatchObject({
      transient: false, attempts: 1, code: '42883',
    });
    expect(sb.calls).toHaveLength(1);
  });

  it('exhausts its attempts and reports transient -- never a silent pass', async () => {
    const sb = stubClient([{ data: null, error: timeout }]);
    const err = await rpcWithRetry(sb, 'f', {}, { attempts: 3, sleep: noSleep }).catch((e) => e);
    expect(err).toBeInstanceOf(RpcError);
    expect(err.transient).toBe(true);
    expect(err.attempts).toBe(3);
    expect(sb.calls).toHaveLength(3);
  });

  it('backs off exponentially between attempts', async () => {
    const slept = [];
    const sb = stubClient([{ data: null, error: timeout }]);
    await rpcWithRetry(sb, 'f', {}, {
      attempts: 3, baseDelayMs: 100, sleep: async (ms) => { slept.push(ms); },
    }).catch(() => {});
    // Two waits for three attempts -- and none after the last, which would be
    // pure dead time before an error the caller already has.
    expect(slept).toEqual([100, 200]);
  });

  it('rejects a nonsense attempts count rather than silently doing nothing', async () => {
    const sb = stubClient([{ data: 1, error: null }]);
    await expect(rpcWithRetry(sb, 'f', {}, { attempts: 0 })).rejects.toBeInstanceOf(TypeError);
    expect(sb.calls).toHaveLength(0);
  });
});

describe('rpcOnce', () => {
  // The double-apply guard. A mutating RPC must be called exactly once even
  // when the failure looks retryable.
  it('never retries a transient failure, but still flags it transient', async () => {
    const sb = stubClient([{ data: null, error: timeout }]);
    const err = await rpcOnce(sb, 'mutate', {}).catch((e) => e);
    expect(err.transient).toBe(true);
    expect(sb.calls).toHaveLength(1);
  });

  it('flags a genuine failure as non-transient', async () => {
    const sb = stubClient([{ data: null, error: contractError }]);
    await expect(rpcOnce(sb, 'mutate', {})).rejects.toMatchObject({ transient: false });
  });
});

describe('exitTransient', () => {
  it('exits 2 on a transient error', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitTransient(new RpcError('f', timeout, { transient: true, attempts: 3 }), 'my check');
    expect(exit).toHaveBeenCalledWith(2);
    expect(errSpy.mock.calls[0][0]).toContain('my check');
  });

  // The fail-open found at review: a raw PostgREST error that never passed
  // through rpcWithRetry carries no .transient flag, so gating on that field
  // alone made the natural retrofit `exitTransient(error)` a silent no-op.
  it('exits 2 for a RAW transient error that never went through rpcWithRetry', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitTransient({ code: '57014', message: 'canceling statement due to statement timeout' });
    expect(exit).toHaveBeenCalledWith(2);
  });

  it('still returns for a RAW error that is a genuine contract failure', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    exitTransient(contractError);
    expect(exit).not.toHaveBeenCalled();
  });

  // The fail-open direction: a real defect must not be able to leave via exit 2.
  // It returns rather than throwing so the caller's own branches -- notably
  // "PGRST202 means the RPC is missing, exit 1" -- stay REACHABLE.
  it('returns on a non-transient error, without exiting, so the caller can handle it', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const boom = new RpcError('f', contractError, { transient: false, attempts: 1 });
    expect(() => exitTransient(boom)).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
  });
});
