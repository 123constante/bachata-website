// @vitest-environment jsdom
/**
 * Series editor form polish: 16px inputs (no iOS zoom), readable error text,
 * and Discard asking first when there are unsaved edits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../components/VenuePicker', () => ({ VenuePicker: () => null }));
vi.mock('@/modules/organiser/shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [] }), venueName: () => null }));

import { InstagramField, PricesFieldset, SeriesEditor } from '../components/SeriesEditor';
import type { SeriesWorkspace, WorkspaceSeries } from '@/modules/organiser/shared/seriesModel';

const series = {
  id: 's1', name: 'Thursday Party', slug: 'thursday-party', format: 'recurring', category: 'party',
  lifecycle_status: 'live', version: 3, default_venue_id: 'v1', default_local_start_time: '20:00:00',
  default_duration: '02:00:00', default_level: null, default_ticket_url: null, default_description: null,
  default_cover_image_url: null, default_start_date: null, instagram_url: null, passes: null, created_at: null,
  recurrence_rule: null, removed_dates: [],
} as WorkspaceSeries;
const workspace: SeriesWorkspace = { series, hasSessions: false, dates: [] };

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><SeriesEditor workspace={workspace} today="2026-10-07" /></MemoryRouter>
  </QueryClientProvider>,
);
const name = () => screen.getByLabelText('Name') as HTMLInputElement;
const edit = () => fireEvent.change(name(), { target: { value: 'Thursday Bachata' } });

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

describe('dormant Instagram and price fields', () => {
  it('Instagram input is 16px so iOS Safari does not zoom, and its error is text-xs', () => {
    render(<InstagramField value="nope" ok={false} onChange={() => {}} />);
    const input = screen.getByLabelText('Instagram link');
    expect(input.className).toContain('text-[16px]');
    expect(input.className).toContain('md:text-[16px]');
    expect(input.className).not.toMatch(/(^|\s)text-sm/);
    const hint = screen.getByTestId('instagram-hint');
    expect(hint.className).toContain('text-xs');
    expect(hint.className).not.toContain('text-[11px]');
  });

  it('no Instagram error when the link is fine', () => {
    render(<InstagramField value="" ok onChange={() => {}} />);
    expect(screen.queryByTestId('instagram-hint')).toBeNull();
  });

  it('price name and amount inputs are 16px, and the prices error is text-xs', () => {
    render(<PricesFieldset rows={[{ id: 'r1', name: '', price: '', currency: 'GBP' } as never]} problem="Give every price a name." onChange={() => {}} />);
    for (const label of ['Price 1 name', 'Price 1 amount']) {
      const cls = screen.getByLabelText(label).className;
      expect(cls).toContain('text-[16px]');
      expect(cls).toContain('md:text-[16px]');
      expect(cls).not.toMatch(/(^|\s)text-sm/);
    }
    const hint = screen.getByTestId('prices-hint');
    expect(hint.className).toContain('text-xs');
    expect(hint.className).not.toContain('text-[11px]');
  });
});

describe('Discard asks first', () => {
  it('is disabled with nothing changed, so there is nothing to confirm', () => {
    mount();
    expect((screen.getByTestId('basics-discard') as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks before wiping edits, and the edits survive until confirmed', () => {
    mount();
    edit();
    fireEvent.click(screen.getByTestId('basics-discard'));
    expect(screen.getByTestId('discard-confirm')).toBeTruthy();
    expect(name().value).toBe('Thursday Bachata');
  });

  it('moves focus to "Keep editing" when the question opens', () => {
    mount();
    edit();
    fireEvent.click(screen.getByTestId('basics-discard'));
    expect(document.activeElement).toBe(screen.getByTestId('confirm-keep'));
  });

  it('Keep editing keeps the edits and returns focus to Discard', () => {
    mount();
    edit();
    fireEvent.click(screen.getByTestId('basics-discard'));
    fireEvent.click(screen.getByTestId('confirm-keep'));
    expect(screen.queryByTestId('discard-confirm')).toBeNull();
    expect(name().value).toBe('Thursday Bachata');
    expect(document.activeElement).toBe(screen.getByTestId('basics-discard'));
  });

  it('confirming restores the saved values and puts focus on the form', () => {
    mount();
    edit();
    fireEvent.click(screen.getByTestId('basics-discard'));
    fireEvent.click(screen.getByTestId('confirm-go'));
    expect(screen.queryByTestId('discard-confirm')).toBeNull();
    expect(name().value).toBe('Thursday Party');
    expect(screen.queryByTestId('basics-unsaved')).toBeNull();
    expect(document.activeElement).toBe(name());
  });
});
