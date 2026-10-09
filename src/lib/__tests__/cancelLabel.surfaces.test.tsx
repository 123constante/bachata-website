// Every public surface that shows a cancelled date's reason, driven over one
// shared shape table. Owner decision 2026-10-08: reason 'Other' (or blank) is
// not a reason a dancer can use, so it reads as plain "Cancelled"; any other
// reason from the cancellation_reasons list reads "Cancelled <dot> reason".
// Prod survey the same day: of 139 cancelled dates, 14 carried 'Other', 10 a
// real reason and 115 none (null, or no override row); none were blank.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { asWallClock } from '@/lib/time/wallClock';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { CancelledRedStrip } from '@/modules/event-page/bento/blocks/CancelledRedStrip';
import { EventCancelledBanner } from '@/modules/event-page/bento/EventCancelledBanner';
import { DateBlock } from '@/modules/event-page/bento/blocks/DateBlock';
import { CANCEL_REASON_SHAPES } from './cancelLabelShapes';

const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const occ = (reason: string | null): EventPageSnapshotOccurrence => ({
  occurrenceId: 'o1',
  startsAt: asWallClock('2026-09-10T20:00:00'),
  endsAt: asWallClock('2026-09-10T23:00:00'),
  localDate: asWallClock('2026-09-10T00:00:00'),
  timezone: 'Europe/London',
  isCancelled: true,
  cancellationReasonLabel: reason,
  isLive: false,
  isPast: false,
  isUpcoming: true,
  lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
});

describe.each(CANCEL_REASON_SHAPES)('cancel reason shape: $name', ({ input, shown }) => {
  it('CancelledRedStrip (Tonight + calendar list cards) never prints a meaningless reason', () => {
    const t = text(renderToStaticMarkup(<CancelledRedStrip reasonLabel={input} />));
    expect(t).toBe(shown ? `Cancelled ${shown}` : 'Cancelled Event cancelled by organiser');
  });

  it('EventCancelledBanner (event page + festival page) shows the reason line only for a real reason', () => {
    const t = text(renderToStaticMarkup(<EventCancelledBanner reasonLabel={input} />));
    expect(t).toBe(shown ? `This event has been cancelled ${shown} CANCELLED` : 'This event has been cancelled CANCELLED');
  });

  it('DateBlock shows the reason line only for a real reason', () => {
    const html = renderToStaticMarkup(<DateBlock occurrence={occ(input)} />);
    const m = html.match(/data-testid="date-cancelled-reason"[^>]*>([^<]*)</);
    expect(m?.[1] ?? null).toBe(shown);
    expect(html).toContain('data-testid="date-cancelled-badge"');
  });
});

describe('home map popup', () => {
  // EventMap.tsx pulls leaflet + a maplibre worker URL import, which vitest
  // cannot load; the popup line is the shared helper's output, so pin the wiring.
  const src = readFileSync(resolve(__dirname, '../../modules/home-map/EventMap.tsx'), 'utf8');
  it('builds the cancelled line from the shared helper, not the raw reason', () => {
    expect(src).toContain('esc(cancelledLabel(e.cancellation_reason_label))');
    expect(src).not.toMatch(/cancellation_reason_label\s*\?/);
  });
});
