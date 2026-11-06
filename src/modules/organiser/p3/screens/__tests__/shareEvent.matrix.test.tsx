// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ws } from './wsFixtures';
import { SHARE_SUB, publicPageOf, shareOf } from '../../data/eventPage';
import { eventHref } from '@/lib/seo/eventHref';
import { P3_PATHS } from '../../shell/paths';

/* p3-share-event-link: lifecycle x slug x capability -> row state, message, exact url. */

const wsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => wsQ.value,
  useRunCommands: () => async () => 8,
  useSendOnce: () => async () => ({ ok: true }),
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';

const ORIGIN = window.location.origin;
const COPIED = 'Link copied.';
const FAILED = 'Couldn’t copy. Tap and hold the link below to copy it.';
const CAPS = ['shareOk', 'shareAborts', 'clipboardOnly', 'clipboardRejects', 'neither'] as const;
type Cap = (typeof CAPS)[number];

let shareFn: ReturnType<typeof vi.fn> | undefined;
let writeFn: ReturnType<typeof vi.fn> | undefined;
function setCaps(c: Cap) {
  shareFn = c === 'shareOk' ? vi.fn().mockResolvedValue(undefined)
    : c === 'shareAborts' ? vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) : undefined;
  writeFn = c === 'clipboardOnly' || c === 'shareOk' || c === 'shareAborts' ? vi.fn().mockResolvedValue(undefined)
    : c === 'clipboardRejects' ? vi.fn().mockRejectedValue(new Error('denied')) : undefined;
  Object.defineProperty(navigator, 'share', { value: shareFn, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: writeFn ? { writeText: writeFn } : undefined, configurable: true });
}

function show(lifecycle: string, slug: string | null) {
  const w = ws('weekly');
  wsQ.value = { isPending: false, isError: false, data: { ...w, series: { ...w.series, lifecycle_status: lifecycle, slug } }, error: null, refetch: vi.fn() };
  return render(
    <MemoryRouter initialEntries={[P3_PATHS.event('ser-1')]}>
      <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => setCaps('shareOk'));
afterEach(cleanup);

const OPEN = ['live', 'paused', 'ended'];
const SHUT = ['draft', 'archived'];

describe('shareOf', () => {
  it.each([...OPEN, ...SHUT].flatMap((lc) => [[lc, 'sensual-fridays'], [lc, null]] as const))('%s slug=%s', (lc, slug) => {
    const w = { ...ws('weekly'), series: { ...ws('weekly').series, lifecycle_status: lc, slug } };
    const pub = publicPageOf(w);
    const got = shareOf(w, 'https://x.test');
    if (pub.href) expect(got).toEqual({ url: `https://x.test${eventHref({ slug: slug!, event_id: 'ser-1' })}`, title: 'Sensual Fridays' });
    else expect(got).toEqual({ off: true, why: pub.why });
  });
});

describe('Share this event x lifecycle x slug x capability', () => {
  for (const lc of ['draft', 'live', 'paused', 'ended']) {
    for (const slug of ['sensual-fridays', null]) {
      for (const cap of CAPS) {
        it(`${lc} / ${slug ?? 'no slug'} / ${cap}`, async () => {
          setCaps(cap);
          show(lc, slug);
          const on = OPEN.includes(lc) && !!slug;
          if (!on) {
            const off = screen.getByTestId('p3-share-off');
            expect(off.getAttribute('aria-disabled')).toBe('true');
            const base = ws('weekly');
            expect(screen.getByTestId('p3-share-why').textContent).toBe(publicPageOf({ ...base, series: { ...base.series, lifecycle_status: lc, slug } }).why);
            expect(screen.queryByTestId('p3-share')).toBeNull();
            return;
          }
          const url = `${ORIGIN}${eventHref({ slug: slug!, event_id: 'ser-1' })}`;
          expect(url).not.toMatch(/[?&]utm_|\?/);
          const btn = screen.getByTestId('p3-share');
          expect(btn.textContent).toContain('Share this event');
          expect(btn.textContent).toContain(SHARE_SUB);
          fireEvent.click(btn);
          if (cap === 'shareOk') {
            await waitFor(() => expect(shareFn).toHaveBeenCalledWith({ title: 'Sensual Fridays', url }));
            expect(writeFn).not.toHaveBeenCalled();
            expect(screen.queryByTestId('p3-share-note')).toBeNull();
          } else if (cap === 'shareAborts') {
            await waitFor(() => expect(shareFn).toHaveBeenCalled());
            await Promise.resolve();
            expect(writeFn).not.toHaveBeenCalled();
            expect(screen.queryByTestId('p3-share-note')).toBeNull();
          } else if (cap === 'clipboardOnly') {
            await waitFor(() => expect(screen.getByTestId('p3-share-note').textContent).toBe(COPIED));
            expect(writeFn).toHaveBeenCalledWith(url);
          } else {
            await waitFor(() => expect(screen.getByTestId('p3-share-note').textContent).toContain(FAILED));
            expect(screen.getByTestId('p3-share-url').textContent).toBe(url);
          }
          // no copy points at a control that is not on screen: the only things the notes name are the url shown beside them
          const note = screen.queryByTestId('p3-share-note')?.textContent ?? '';
          if (/link below/.test(note)) expect(screen.getByTestId('p3-share-url')).toBeTruthy();
        });
      }
    }
  }
});
