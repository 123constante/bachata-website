// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDash, type DashInput, type DashNight } from '../dashModel';
import { DashView } from '../DashView';
import { captionOf, nightLinkOf, pageLinkOf, shareText, whatsappHref } from '../shareLinks';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const night = (o: Partial<DashNight> = {}): DashNight => ({
  key: 'a:1', date: '2026-12-11', when: 'Friday 11 December, 8pm', name: 'Ritmo', cancelled: false, going: 12, opens: 248, taps: {}, ticketsSold: 0,
  link: 'https://bachatacalendar.com/event/ritmo', ...o,
});
const input = (n: DashNight): DashInput => ({
  load: 'ready', seat: 'owner', nights: [n], upcomingDates: 1, pageLink: 'https://bachatacalendar.com/organisers/p1', profileSteps: [],
  cityOrganisers: null, cityAverage: null, sellingViaUs: false, teamCount: 1,
});
const view = (n: DashNight, pageLink: string | null = 'https://bachatacalendar.com/organisers/p1') =>
  render(<MemoryRouter><DashView model={buildDash(input(n))} pageName="Page" pageLink={pageLink} /></MemoryRouter>);

describe('share links', () => {
  it('builds real routes, no fictional domain', () => {
    expect(pageLinkOf('https://x.test', 'p 1')).toBe('https://x.test/organisers/p%201');
    expect(nightLinkOf('https://x.test', 'ritmo')).toBe('https://x.test/event/ritmo');
    expect(nightLinkOf('https://x.test', '')).toBeNull();
    expect(whatsappHref('a b')).toBe('https://wa.me/?text=a%20b');
    expect(captionOf('Ritmo', 'Friday', 'https://x.test/event/r')).toContain('https://x.test/event/r');
  });

  it('native share first, then clipboard, then WhatsApp', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    expect(await shareText('t', 'x', 'u')).toBe('shared');
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('no')), clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    expect(await shareText('t', 'x', 'u')).toBe('copied');
    const open = vi.fn();
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('open', open);
    expect(await shareText('t', 'x', 'u')).toBe('whatsapp');
    expect(open.mock.calls[0][0]).toContain('https://wa.me/?text=');
  });
});

describe('share UI', () => {
  it('hero night with a link: caption sheet carries the real link and a WhatsApp anchor', () => {
    view(night());
    expect(screen.getByTestId('dash-caption-text').textContent).toContain('https://bachatacalendar.com/event/ritmo');
    expect(screen.getByTestId('dash-whatsapp').getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect((screen.getByTestId('dash-hero-action') as HTMLButtonElement).disabled).toBe(false);
  });
  it('hero night without a link: Share disabled with a reason, no caption sheet', () => {
    view(night({ link: null }));
    expect((screen.getByTestId('dash-hero-action') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('dash-hero-action-why').textContent).toMatch(/no public link/);
    expect(screen.queryByTestId('dash-caption')).toBeNull();
  });
  it('Tell your group is disabled without a page link', () => {
    view(night({ cancelled: false }), null);
    expect(screen.queryByTestId('dash-tell-group-wa')).toBeNull();
  });
});
