// @vitest-environment jsdom
/**
 * source_url through EmptyCityNote (getSourceUrl -> listingSourceUrl) and through
 * a bare form (a gate): the 2026-10-27 bundle trim moved the city rule out of the
 * form, and the payload must not move with it. Same assertions pass on the code
 * before the trim (where the form took citySlug).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ calls: [] as { fn: string; args: { p_payload: Record<string, unknown> } }[] }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string, args: { p_payload: Record<string, unknown> }) => {
    h.calls.push({ fn, args });
    return { data: { ok: true, id: 'x' }, error: null };
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: unknown }) => children }));

import EmptyCityNote, { EMPTY_CITY_TELL_US } from '@/components/listing/EmptyCityNote';
import ListingRequestForm from '@/components/ListingRequestForm';

async function fillAndSend() {
  fireEvent.change((await screen.findAllByRole('textbox'))[0], { target: { value: 'Sam' } });
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '07000000000' } });
  fireEvent.change(screen.getByLabelText(/Event link/), { target: { value: 'https://fb.me/e/1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send my details' }));
  await screen.findByRole('status');
}

beforeEach(() => {
  h.calls = [];
});
afterEach(cleanup);

describe('source_url per surface', () => {
  it.each([
    ['/djs', 'bristol-gb', '/djs?city=bristol-gb'],
    ['/search?q=x', 'bristol-gb', '/search?q=x&city=bristol-gb'],
    ['/city/bristol-gb/venues', 'bristol-gb', '/city/bristol-gb/venues'],
    ['/djs', null, '/djs'],
  ])('EmptyCityNote on %s (city %s) sends %s', async (path, slug, want) => {
    window.history.replaceState(null, '', path);
    render(<EmptyCityNote cityName="Bristol" citySlug={slug} />);
    fireEvent.click(screen.getByRole('button', { name: EMPTY_CITY_TELL_US }));
    await fillAndSend();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].args.p_payload.source_url).toBe(want);
  });

  it('a gate (no getSourceUrl) sends the page path + query as is', async () => {
    window.history.replaceState(null, '', '/organisers?ref=1');
    render(<ListingRequestForm section="organisers_directory" />);
    await fillAndSend();
    expect(h.calls[0].args.p_payload.source_url).toBe('/organisers?ref=1');
  });
});
