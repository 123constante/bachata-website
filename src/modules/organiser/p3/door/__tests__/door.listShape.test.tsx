// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ScannerDeps } from '../camera';

/*
 * p3-prefix-d D1: only an explicit `not_allowed` from ticket_door_list_v1 may show CANNOT CHECK
 * TICKETS. Every other answer that is not a well-formed `ok` is a LOAD problem: Could not load,
 * Try again, and the Scan tab keeps its code box. The RPC layer is faked, not fetchDoorList, so
 * the real parser decides.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
import { Door } from '../DoorScreen';
import { parseDoorList } from '../data';

const OK = { result: 'ok', rows: [{ ticket_id: 't1', first_name: 'Aisha', quantity_in_order: 1, ticket_type_name: 'Standard', checked_in_at: null }], truncated: false, in_count: 0, total_count: 1 };
const NOT_ALLOWED = { result: 'not_allowed', rows: [], truncated: false, in_count: null, total_count: null };

type Screen = 'list' | 'not_allowed' | 'load_error';
// shape name, what the RPC answers (or throws), what the screen must show
const SHAPES: Array<[string, { data?: unknown; error?: unknown; throws?: boolean }, Screen]> = [
  ['ok', { data: OK }, 'list'],
  ['not_allowed', { data: NOT_ALLOWED }, 'not_allowed'],
  ['null', { data: null }, 'load_error'],
  ['empty array', { data: [] }, 'load_error'],
  ['unknown result', { data: { result: 'rate_limited' } }, 'load_error'],
  ['no result key', { data: { rows: OK.rows } }, 'load_error'],
  ['partial ok (no rows)', { data: { result: 'ok' } }, 'load_error'],
  ['ok with rows not a list', { data: { result: 'ok', rows: 'x' } }, 'load_error'],
  ['rpc error', { error: { message: 'boom', code: '500' } }, 'load_error'],
  ['thrown', { throws: true }, 'load_error'],
];

const deps: ScannerDeps = {
  getStream: async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream,
  makeDetector: async () => async () => null,
  every: 50,
};

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Door seriesId="ser-1" deps={deps} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { rpc.mockReset(); });
afterEach(() => { cleanup(); });

describe('parseDoorList: only explicit answers are believed', () => {
  it.each(SHAPES.filter(([, a]) => 'data' in a))('%s', (_n, a, want) => {
    if (want === 'load_error') expect(() => parseDoorList(a.data)).toThrow();
    else expect(parseDoorList(a.data).result).toBe(want === 'list' ? 'ok' : 'not_allowed');
  });
});

describe('the door list answer x the screen', () => {
  it.each(SHAPES)('%s', async (_n, a, want) => {
    rpc.mockImplementation(async () => {
      if (a.throws) throw new Error('network');
      return { data: a.data ?? null, error: a.error ?? null };
    });
    show();
    fireEvent.click(screen.getByTestId('door-tab-list'));
    if (want === 'list') {
      expect(await screen.findByTestId('door-list')).toBeTruthy();
      expect(screen.queryByTestId('door-result')).toBeNull();
    } else if (want === 'not_allowed') {
      const card = await screen.findByTestId('door-result');
      expect(card.getAttribute('data-state')).toBe('not_allowed');
      expect(screen.queryByTestId('door-list-error')).toBeNull();
    } else {
      const err = await screen.findByTestId('door-list-error', {}, { timeout: 4000 });
      expect(err.textContent).toContain('Try again');
      expect(screen.queryByTestId('door-result')).toBeNull();
      expect(document.body.textContent).not.toContain('CANNOT CHECK TICKETS');
      // the Scan tab is not a permissions wall: the code box is still there
      fireEvent.click(screen.getByTestId('door-tab-scan'));
      expect(await screen.findByTestId('door-codebox')).toBeTruthy();
      expect(screen.queryByTestId('door-result')).toBeNull();
    }
  });

  it('offline from the start -> load_error (Check the signal + Try again), never "Loading" for ever', async () => {
    onlineManager.setOnline(false);
    try {
      rpc.mockRejectedValue(new TypeError('Failed to fetch'));
      show();
      fireEvent.click(screen.getByTestId('door-tab-list'));
      const err = await screen.findByTestId('door-list-error', {}, { timeout: 4000 });
      expect(err.textContent).toContain('Check the signal');
      expect(err.textContent).toContain('Try again');
      expect(screen.queryByTestId('door-list-loading')).toBeNull();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  // the screen's own query retries once (about 1 s) before it shows the error
  it('Try again after a bad answer loads the list once the answer is good', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: null }).mockResolvedValue({ data: OK, error: null });
    show();
    fireEvent.click(screen.getByTestId('door-tab-list'));
    const err = await screen.findByTestId('door-list-error', {}, { timeout: 4000 });
    fireEvent.click(err.querySelector('button')!);
    expect(await screen.findByTestId('door-list')).toBeTruthy();
  });
});

describe('the QR reader chunk (jsQR) will not load', () => {
  it('the camera reads as failed and the code box is offered, never a blank screen', async () => {
    rpc.mockResolvedValue({ data: OK, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const broken: ScannerDeps = { ...deps, makeDetector: () => Promise.reject(new Error('Failed to fetch dynamically imported module: jsqr')) };
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><Door seriesId="ser-1" deps={broken} /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId('door-cam-dead')).toBeTruthy();
    expect(screen.getByTestId('door-codebox')).toBeTruthy();
    expect(screen.getByTestId('door-back').getAttribute('href')).toBe('/account/p3/events/ser-1');
  });
});
