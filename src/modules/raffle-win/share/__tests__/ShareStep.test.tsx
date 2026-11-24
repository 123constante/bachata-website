// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShareStep } from '../ShareStep';

const h = vi.hoisted(() => ({
  share: vi.fn(), download: vi.fn(), render: vi.fn(), pngNull: false,
}));
vi.mock('../../sharePoster', async (orig) => ({
  ...(await orig<typeof import('../../sharePoster')>()),
  renderPoster: (...a: unknown[]) => { h.render(...a); return Promise.resolve(); },
  canvasToPng: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })),
  sharePosterFile: (...a: unknown[]) => h.share(...a),
  downloadPng: (...a: unknown[]) => h.download(...a),
}));

const night = {
  occurrenceId: 'o1', title: 'Sensual Thursdays', startLocal: '2026-11-26T20:30',
  venueName: 'Bar Luna, Shoreditch', posterUrl: null, publicEventId: 'e1',
};
const LINK = 'bachata.example/event/e1';
const setup = (onDone = vi.fn()) => {
  render(<ShareStep night={night} dancersInDraw={148} link={LINK} firstName="Maya" onDone={onDone} />);
  return onDone;
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ShareStep keep-list', () => {
  it('copy: label, title, lead, aria', async () => {
    setup();
    expect(screen.getByText('Night confirmed')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Share your win' })).toBeTruthy();
    expect(screen.getByText('Tell your friends you are going. Your QR code is one tap back.')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Share poster: won a free night at Sensual Thursdays' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Drawing your poster/)).toBeNull());
  });

  it('shows drawing state until rendered, buttons disabled meanwhile', async () => {
    setup();
    expect(screen.getByText('Drawing your poster…')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Share' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Share' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('poster text: name, won, at, date, venue first part, pill, link', async () => {
    setup();
    await waitFor(() => expect(h.render).toHaveBeenCalled());
    const t = h.render.mock.calls[0][1];
    expect(t).toMatchObject({
      headline: 'Maya', won: 'won a free night', at: 'at', title: 'Sensual Thursdays',
      pill: '148 dancers in the draw', link: LINK, venueLine: 'Bar Luna, Shoreditch',
    });
    expect(t.dateLine.startsWith('Thu 26 Nov')).toBe(true);
  });

  it('Share: completed calls onDone; cancelled stays', async () => {
    const onDone = setup();
    const btn = () => screen.getByRole('button', { name: 'Share' });
    await waitFor(() => expect((btn() as HTMLButtonElement).disabled).toBe(false));
    h.share.mockResolvedValueOnce('cancelled');
    fireEvent.click(btn());
    await waitFor(() => expect(h.share).toHaveBeenCalledTimes(1));
    expect(h.share.mock.calls[0][1].title).toBe('Sensual Thursdays');
    expect(onDone).not.toHaveBeenCalled();
    h.share.mockResolvedValueOnce('shared');
    fireEvent.click(btn());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('Save image downloads raffle-win-{slug}.png and stays', async () => {
    const onDone = setup();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save image' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Save image' }));
    await waitFor(() => expect(h.download).toHaveBeenCalled());
    expect(h.download.mock.calls[0][1]).toBe('raffle-win-sensual-thursdays.png');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('Skip, show my QR calls onDone, even while drawing', () => {
    const onDone = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Skip, show my QR' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
