// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ on: true, fetch: vi.fn(), answer: vi.fn() }));
vi.mock('@/lib/featureFlags', () => ({ flags: { get profileMatchAsk() { return h.on; } } }));
vi.mock('@/lib/profileMatch', () => ({ fetchMatchCandidates: h.fetch, answerMatch: h.answer }));

import { MatchAskCard } from '../MatchAskCard';

const cand = { id: 'p1', name: 'Ana Lopez', city: 'Bristol', avatar_url: null };
const renderCard = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MatchAskCard /></QueryClientProvider>);

describe('MatchAskCard', () => {
  beforeEach(() => { h.on = true; h.fetch.mockReset(); h.answer.mockReset(); });
  afterEach(cleanup);

  it('flag off renders nothing', async () => {
    h.on = false; h.fetch.mockResolvedValue([cand]);
    const { container } = renderCard();
    await new Promise((r) => setTimeout(r, 20));
    expect(container.innerHTML).toBe('');
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('0 candidates renders nothing', async () => {
    h.fetch.mockResolvedValue([]);
    const { container } = renderCard();
    await waitFor(() => expect(h.fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container.innerHTML).toBe('');
  });

  it('1 candidate shows title, name, city, both buttons', async () => {
    h.fetch.mockResolvedValue([cand]);
    renderCard();
    expect(await screen.findByText('Is this you?')).toBeTruthy();
    expect(screen.getByText('Ana Lopez')).toBeTruthy();
    expect(screen.getByText('Bristol')).toBeTruthy();
    expect(screen.getByText('Yes, this is me')).toBeTruthy();
    expect(screen.getByText('No, not me')).toBeTruthy();
  });

  it('Yes answers me and shows the thanks line', async () => {
    h.fetch.mockResolvedValue([cand]); h.answer.mockResolvedValue('recorded');
    renderCard();
    fireEvent.click(await screen.findByTestId('match-ask-yes'));
    await waitFor(() => expect(h.answer).toHaveBeenCalledWith('p1', 'me'));
    expect(await screen.findByTestId('match-ask-thanks')).toBeTruthy();
    expect(screen.queryByTestId('match-ask-yes')).toBeNull();
  });

  it('No answers not_me and hides the card', async () => {
    h.fetch.mockResolvedValue([cand]); h.answer.mockResolvedValue('recorded');
    renderCard();
    fireEvent.click(await screen.findByTestId('match-ask-no'));
    await waitFor(() => expect(h.answer).toHaveBeenCalledWith('p1', 'not_me'));
    await waitFor(() => expect(screen.queryByTestId('match-ask-card-p1')).toBeNull());
  });

  it('error keeps the buttons and shows the error line', async () => {
    h.fetch.mockResolvedValue([cand]); h.answer.mockRejectedValue(new Error('x'));
    renderCard();
    fireEvent.click(await screen.findByTestId('match-ask-yes'));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(screen.getByTestId('match-ask-yes')).toBeTruthy();
    expect(screen.getByTestId('match-ask-no')).toBeTruthy();
  });
});
