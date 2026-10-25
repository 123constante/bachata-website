// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LinkReadResult, ParsedLinkEvent } from '../smartImportClient';

const readEventLink = vi.hoisted(() => vi.fn());
vi.mock('../smartImportClient', () => ({ readEventLink }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-25' }));

import { PasteLink } from '../PasteLink';

const FULL: ParsedLinkEvent = { title: 'Friday Bachata', format: 'one_off', date_iso: '2026-11-06', venue_name: 'The Dance Hall', ticket_url: 'https://t.example/e', description: 'A warm night.' };
const PAST = { ...FULL, date_iso: '2026-01-01' };
const NO_DATE = { ...FULL, date_iso: null };
const LINK = 'https://www.eventbrite.co.uk/e/123';
const FAIL_TEXT = 'We could not read that link. You can add the event by hand';

const onUse = vi.fn();
const onByHand = vi.fn();
const mount = () => render(<MemoryRouter><PasteLink onUse={onUse} onByHand={onByHand} /></MemoryRouter>);
const type = (v: string) => fireEvent.change(screen.getByTestId('org-paste-input'), { target: { value: v } });
const tap = (id: string) => fireEvent.click(screen.getByTestId(id));

beforeEach(() => { readEventLink.mockReset(); onUse.mockReset(); onByHand.mockReset(); });
afterEach(cleanup);

// The role is a property of the signed-in account, not of this panel: both roles get the same
// panel and the same words; only the server's cap differs (and its wording is not shown).
describe.each(['admin', 'organiser'])('%s', () => {
  it('an untouched box sends nothing; Read it is off and says why', () => {
    mount();
    expect((screen.getByTestId('org-paste-read') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-paste-why').textContent).toBe('Paste a link first.');
    tap('org-paste-read');
    expect(readEventLink).not.toHaveBeenCalled();
  });

  it('a non-https link sends nothing and offers Add by hand', () => {
    mount();
    type('http://example.com/e');
    tap('org-paste-read');
    expect(readEventLink).not.toHaveBeenCalled();
    expect(screen.getByTestId('org-paste-failed-message').textContent).toContain(FAIL_TEXT);
    tap('org-paste-byhand');
    expect(onByHand).toHaveBeenCalledOnce();
  });

  it.each([
    ['future date', FULL, '2026-11-06'],
    ['past date', PAST, 'This date has passed, please set the date'],
    ['no date', NO_DATE, 'No date found'],
  ])('ok full, %s: a draft marked "Check this before saving", nothing saved', async (_n, parsed, dateText) => {
    readEventLink.mockResolvedValue({ ok: true, parsed } satisfies LinkReadResult);
    mount();
    type(LINK);
    tap('org-paste-read');
    await screen.findByTestId('org-paste-draft');
    expect(screen.getByTestId('org-paste-check').textContent).toBe('Check this before saving');
    expect(screen.getByTestId('org-paste-date').textContent).toContain(dateText);
    expect(screen.getByTestId('org-paste-title').textContent).toContain('Friday Bachata');
    expect(onUse).not.toHaveBeenCalled();
    tap('org-paste-use');
    expect(onUse).toHaveBeenCalledOnce();
    expect(onUse.mock.calls[0][0].title).toBe('Friday Bachata');
  });

  it('ok partial: says plainly what was not found', async () => {
    readEventLink.mockResolvedValue({ ok: true, parsed: { title: 'X', date_iso: '2026-11-06' } });
    mount();
    type(LINK);
    tap('org-paste-read');
    await screen.findByTestId('org-paste-draft');
    expect(screen.getByTestId('org-paste-venue').textContent).toContain('No venue found');
    expect(screen.getByTestId('org-paste-ticket').textContent).toContain('No ticket link found');
  });

  it('imported markup and a javascript: ticket link render as text only', async () => {
    readEventLink.mockResolvedValue({ ok: true, parsed: { ...FULL, title: '<b>Bold</b>', ticket_url: 'javascript:alert(1)' } });
    const { container } = mount();
    type(LINK);
    tap('org-paste-read');
    await screen.findByTestId('org-paste-draft');
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByTestId('org-paste-title').textContent).toContain('<b>Bold</b>');
    expect(screen.getByTestId('org-paste-ticket').textContent).toContain('No ticket link found');
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it.each([
    ['ok empty', { ok: true, parsed: { title: null, date_iso: null } }, FAIL_TEXT],
    ['unreadable', { ok: false, error: 'llm_unparseable' }, FAIL_TEXT],
    ['network', { ok: false, error: 'network' }, FAIL_TEXT],
    ['timeout', { ok: false, error: 'timeout' }, FAIL_TEXT],
    ['401', { ok: false, error: 'unauthenticated' }, 'You can add the event by hand'],
    ['429', { ok: false, error: 'daily_limit' }, "You have used today's link reads; add this one by hand or try tomorrow"],
  ] as Array<[string, LinkReadResult, string]>)('%s: a plain sentence and a working Add by hand', async (_n, result, text) => {
    readEventLink.mockResolvedValue(result);
    mount();
    type(LINK);
    tap('org-paste-read');
    await screen.findByTestId('org-paste-failed');
    expect(screen.getByTestId('org-paste-failed-message').textContent).toContain(text);
    expect(screen.queryByTestId('org-paste-signin') !== null).toBe('error' in result && result.error === 'unauthenticated');
    tap('org-paste-byhand');
    expect(onByHand).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('org-paste-failed')).toBeNull();
  });

  it('double tap sends once, and Read it is off while reading with a Cancel', async () => {
    let resolve!: (r: LinkReadResult) => void;
    readEventLink.mockReturnValue(new Promise<LinkReadResult>((r) => { resolve = r; }));
    mount();
    type(LINK);
    const read = screen.getByTestId('org-paste-read');
    fireEvent.click(read);
    fireEvent.click(read);
    expect(readEventLink).toHaveBeenCalledOnce();
    expect(screen.getByTestId('org-paste-reading')).toBeTruthy();
    expect(screen.queryByTestId('org-paste-read')).toBeNull();
    resolve({ ok: true, parsed: FULL });
    await screen.findByTestId('org-paste-draft');
  });

  it('Cancel aborts the read and returns to the box with nothing shown', async () => {
    let signal!: AbortSignal;
    readEventLink.mockImplementation((_l: string, o: { signal: AbortSignal }) => { signal = o.signal; return new Promise(() => {}); });
    mount();
    type(LINK);
    tap('org-paste-read');
    tap('org-paste-cancel');
    expect(signal.aborted).toBe(true);
    await waitFor(() => expect((screen.getByTestId('org-paste-read') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId('org-paste-failed')).toBeNull();
    expect(screen.queryByTestId('org-paste-draft')).toBeNull();
  });
});
