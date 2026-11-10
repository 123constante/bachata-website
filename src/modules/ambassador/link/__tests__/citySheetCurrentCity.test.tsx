// @vitest-environment jsdom
/** Brief W1 step 3: confirm how the organiser City sheet shows a current city that search_cities
 *  will never return (an inactive city such as Bristol): it is shown first, from currentName, before
 *  any search -- and a search that does not find it does not list it. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CitySheetBody from '@/modules/organiser/edit-in-place/CitySheetBody';

afterEach(() => cleanup());

function open(searchCities = vi.fn(async () => [{ id: 'c-bath', label: 'Bath' }])) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CitySheetBody value="c-bristol" currentName="Bristol" onPick={() => {}} searchCities={searchCities} inputStyle={{}} inputRef={() => {}} labelledBy="lbl" />
    </QueryClientProvider>,
  );
  return searchCities;
}

describe('CitySheetBody with an inactive current city', () => {
  it('shows the current city first, ticked, without asking search_cities', () => {
    const search = open();
    const radio = screen.getByRole('radio') as HTMLInputElement;
    expect(radio.value).toBe('c-bristol');
    expect(radio.checked).toBe(true);
    expect(screen.getByText('Bristol')).toBeTruthy();
    expect(search).not.toHaveBeenCalled();
  });
  it('a search that cannot return it (inactive) lists only the results', async () => {
    const search = open();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Bri' } });
    await waitFor(() => expect(search).toHaveBeenCalledWith('Bri'), { timeout: 2000 });
    await waitFor(() => expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['c-bath']), { timeout: 2000 });
  });
});
