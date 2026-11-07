// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const searchPeople = vi.fn();
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  searchPeople: (...a: unknown[]) => searchPeople(...a),
}));

import { LineupSheet, LINEUP_ADD_PERSON_MESSAGE } from '../LineupSheet';

type State = 'short' | 'found' | 'nomatch' | 'error' | 'noPeople';
const TERM = 'Zoë & Co';

function mount(state: State, role: 'teaching' | 'djing') {
  searchPeople.mockReset();
  if (state === 'found') searchPeople.mockResolvedValue([{ id: 'p1', name: 'Zoe Co', photo: null }]);
  else if (state === 'error') searchPeople.mockRejectedValue(new Error('boom'));
  else searchPeople.mockResolvedValue([]);
  const type = state === 'noPeople' ? 'performance' : 'class';
  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LineupSheet name="Friday Social" where="Every date" type={type} initial={[]} why={null} busy={false} error={null} onSave={() => {}} onBack={() => {}} />
    </QueryClientProvider>,
  );
  return container;
}

describe('line-up no match offers Ask the team', () => {
  beforeEach(() => cleanup());
  it.each(
    (['short', 'found', 'nomatch', 'error', 'noPeople'] as State[]).flatMap((s) => (['teaching', 'djing'] as const).map((r) => [s, r] as const)),
  )('%s x %s', async (state, role) => {
    const container = mount(state, role);
    if (state !== 'noPeople') {
      if (role === 'djing') fireEvent.click(screen.getByTestId('p3-lineup-role-djing'));
      fireEvent.change(screen.getByTestId('p3-lineup-search'), { target: { value: state === 'short' ? 'a' : TERM } });
    }
    if (state === 'nomatch') await waitFor(() => screen.getByTestId('p3-lineup-nomatch'));
    if (state === 'found') await waitFor(() => screen.getByTestId('p3-lineup-results'));
    if (state === 'error') await waitFor(() => screen.getByRole('alert'));
    if (state === 'short') await new Promise((r) => setTimeout(r, 20));

    const link = screen.queryByTestId('p3-lineup-ask-team') as HTMLAnchorElement | null;
    if (state === 'nomatch') {
      expect(link).not.toBeNull();
      const href = link!.getAttribute('href')!;
      expect(href).toContain(encodeURIComponent(TERM));
      expect(href).toContain(encodeURIComponent(LINEUP_ADD_PERSON_MESSAGE));
      expect(href).toContain(encodeURIComponent('Friday Social'));
      expect(link!.getAttribute('target')).toBe('_blank');
      expect(link!.getAttribute('rel')).toContain('noopener');
      expect(link!.className).toContain('p3-link'); // min-height: var(--tap) in p3.css
      // the words above it still say to ask the team, and the control is on screen
      expect(screen.getByTestId('p3-lineup-nomatch').textContent).toMatch(/ask the Bachata Calendar team/);
    } else {
      expect(link).toBeNull();
    }
    expect(container.innerHTML).not.toMatch(/overflow-x|scroll-x|whitespace-nowrap/);
  });
});
