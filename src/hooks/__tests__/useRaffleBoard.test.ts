import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => rpcMock(...a) }));
import { fetchRaffleBoard } from '../useRaffleBoard';

beforeEach(() => rpcMock.mockReset());

describe('fetchRaffleBoard', () => {
  it('calls raffle_public_board_v1 and parses', async () => {
    rpcMock.mockResolvedValue({ data: { pool_count: 4 }, error: null });
    expect((await fetchRaffleBoard()).poolCount).toBe(4);
    expect(rpcMock).toHaveBeenCalledWith('raffle_public_board_v1');
  });
  it('throws on error, empty board on garbage', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(fetchRaffleBoard()).rejects.toThrow('x');
    rpcMock.mockResolvedValue({ data: 'zzz', error: null });
    expect((await fetchRaffleBoard()).nights).toEqual([]);
  });
});

describe('flag-off guard', () => {
  it('no existing screen imports the hook yet', () => {
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); continue; }
        if (/\.(ts|tsx)$/.test(f) && !p.endsWith('hooks/useRaffleBoard.ts') &&
            /useRaffleBoard/.test(readFileSync(p, 'utf8'))) hits.push(p);
      }
    };
    walk('src');
    expect(hits).toEqual([]);
  });
});
