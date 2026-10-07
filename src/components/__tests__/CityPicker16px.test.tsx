// @vitest-environment jsdom
/**
 * iOS Safari zooms on focus for fields under 16px, and the popover portal sits
 * outside .tap-44, so city rows need their own height. jsdom does no layout:
 * this asserts the classes, not the rendered pixels.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async () => ({
      data: [{ city_id: 'c1', city_name: 'London', city_slug: 'london', country_name: 'UK' }],
      error: null,
    }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.stubEnv('VITE_ENABLE_CITY_REQUESTS', 'true');

import { CityPicker } from '@/components/ui/city-picker';

afterEach(cleanup);

describe('CityPicker 16px fields and 44px rows', () => {
  it('search input, request inputs and city rows carry the classes', async () => {
    (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
    Element.prototype.scrollIntoView ??= () => {};
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <CityPicker onChange={() => {}} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('combobox'));

    const search = await screen.findByPlaceholderText('Search city...');
    expect(search.className).toContain('text-[16px]');
    expect(search.className).toContain('md:text-[16px]');

    const row = (await screen.findByText('London, UK')).closest('[cmdk-item]') as HTMLElement;
    expect(row.className).toContain('min-h-[44px]');

    fireEvent.click(await screen.findByText('Add a missing city...'));
    for (const ph of ['e.g. Kyoto', 'e.g. Japan']) {
      const input = await screen.findByPlaceholderText(ph);
      expect(input.className).toContain('text-[16px]');
      expect(input.className).toContain('md:text-[16px]');
    }
  });
});
