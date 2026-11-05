// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { L } from '../../model';
import { VENUE_LIST_COPY, VenueList } from '../VenueList';

/* F-17 (shared place list), F-18 (free-switch copy), F-19 (empty cancel reasons). */

vi.mock('../../../shared/selfServeApi', async (o) => ({ ...(await o<typeof import('../../../shared/selfServeApi')>()), fetchCancellationReasons: async () => [] }));
afterEach(cleanup);
const q = (o: object) => ({ isPending: false, isError: false, data: undefined, refetch: vi.fn(), ...o }) as never;

describe('F-17 the place list, both sheets', () => {
  it.each([
    ['loading', { isPending: true }, VENUE_LIST_COPY.loading, false],
    ['failed', { isError: true }, VENUE_LIST_COPY.fail, true],
    ['empty', { data: [] }, VENUE_LIST_COPY.empty, true],
  ])('%s says what is happening%s', (_n, o, text, retry) => {
    const venues = q(o);
    render(<VenueList venues={venues} testId="v">{() => null}</VenueList>);
    expect(screen.getByText(text)).toBeTruthy();
    expect(!!screen.queryByTestId('p3-venues-retry')).toBe(retry);
    if (retry) {
      fireEvent.click(screen.getByTestId('p3-venues-retry'));
      expect((venues as unknown as { refetch: () => void }).refetch).toHaveBeenCalled();
    }
  });
  it('a list renders its rows', () => {
    render(<VenueList venues={q({ data: [{ id: 'a' }] })} testId="v">{(l) => l.map((x) => <i key={x.id} data-testid="row" />)}</VenueList>);
    expect(screen.getAllByTestId('row')).toHaveLength(1);
  });
});

describe('F-18 the empty price line names the switch only when it is on screen', () => {
  it('both shapes', () => {
    expect(L.pricesNone(true)).toMatch(/free/);
    expect(L.pricesNone(false)).not.toMatch(/free/i);
    expect(L.pricesNone(false)).toMatch(/Add a price/);
  });
});

describe('F-19 an empty list of cancel reasons', () => {
  it('says why and offers Try again', async () => {
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const { ReasonPick } = await import('../CancelEventSheet');
    const { CANCEL_COPY } = await import('../../data/eventPage');
    render(<QueryClientProvider client={new QueryClient()}><ReasonPick picked={null} busy={false} onPick={() => undefined} /></QueryClientProvider>);
    expect(await screen.findByTestId('p3-cancel-reasons-empty')).toBeTruthy();
    expect(screen.getByText(CANCEL_COPY.emptyReasons)).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
