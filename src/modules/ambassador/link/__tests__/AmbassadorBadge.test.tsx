// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { AmbassadorBadge, AMBASSADOR_LABEL, AMBASSADOR_NOTE } from '../AmbassadorBadge';

const wrap = (userId: string | null) =>
  render(<AmbassadorBadge userId={userId} />);

const CASES: Array<[string, () => void, boolean]> = [
  ['ambassador', () => rpc.mockResolvedValue({ data: true, error: null }), true],
  ['not ambassador', () => rpc.mockResolvedValue({ data: false, error: null }), false],
  ['null answer', () => rpc.mockResolvedValue({ data: null, error: null }), false],
  ['rpc error', () => rpc.mockResolvedValue({ data: null, error: { message: 'x' } }), false],
  ['rpc throws', () => rpc.mockImplementation(() => { throw new Error('net'); }), false],
  ['signed-out anon denied', () => rpc.mockResolvedValue({ data: null, error: { code: '42501' } }), false],
];

describe('AmbassadorBadge', () => {
  beforeEach(() => rpc.mockReset());
  afterEach(cleanup);
  it.each(CASES)('%s', async (_n, setup, shown) => {
    setup();
    wrap('u1');
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('is_city_ambassador_public_v1', { p_user_id: 'u1' }));
    if (shown) {
      expect(await screen.findByText(AMBASSADOR_LABEL)).toBeTruthy();
      expect(screen.queryByTestId('ambassador-note')).toBeNull();
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(AMBASSADOR_NOTE)).toBeTruthy();
    } else {
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByTestId('ambassador-badge')).toBeNull();
    }
  });
  it('no id, no call', () => {
    wrap(null);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('label is a single mapping', () => {
    expect(AMBASSADOR_LABEL).toBe('Ambassador');
  });
});
