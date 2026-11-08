// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const searchPeople = vi.fn();
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  searchPeople: (...a: unknown[]) => searchPeople(...a),
}));

import { readFileSync } from 'node:fs';
import { LineupSheet, LINEUP_ADD_PERSON_MESSAGE, askTeamTerm } from '../LineupSheet';

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

describe('ask-the-team text is trimmed and capped', () => {
  beforeEach(() => cleanup());
  const rows: Array<[string, string, string]> = [
    ['padded', '   Ana   Maria  ', 'Ana Maria'],
    ['200 chars', 'x'.repeat(200), 'x'.repeat(60)],
    ['emoji', 'Ana \u{1F483}', 'Ana \u{1F483}'],
    ['amp and hash', 'A&B #1', 'A&B #1'],
  ];
  it.each(rows)('%s', async (_n, typed, sent) => {
    searchPeople.mockReset();
    searchPeople.mockResolvedValue([]);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LineupSheet name="Friday Social" where="Every date" type="class" initial={[]} why={null} busy={false} error={null} onSave={() => {}} onBack={() => {}} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByTestId('p3-lineup-search'), { target: { value: typed } });
    await waitFor(() => screen.getByTestId('p3-lineup-nomatch'));
    const href = (screen.getByTestId('p3-lineup-ask-team') as HTMLAnchorElement).getAttribute('href')!;
    expect(askTeamTerm(typed)).toBe(sent);
    expect(href).toContain(encodeURIComponent(LINEUP_ADD_PERSON_MESSAGE + sent + '. Event'));
    expect(href).not.toContain('%20%20');
    if (typed.includes('&')) expect(href).toContain('%26');
    if (typed.includes('#')) expect(href).toContain('%23');
  });
});

describe('ask-the-team link tap size', () => {
  it('p3-link is at least 44px high by an explicit px token', () => {
    const css = readFileSync('src/modules/organiser/p3/theme/p3.css', 'utf8');
    expect(css).toMatch(/--tap:\s*(\d+)px/);
    expect(Number(/--tap:\s*(\d+)px/.exec(css)![1])).toBeGreaterThanOrEqual(44);
    expect(css).toMatch(/\.p3-link[^{]*\{[^}]*min-height:\s*var\(--tap\)/);
  });
});
