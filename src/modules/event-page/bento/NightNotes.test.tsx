import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FinishedNightCard, CancelledNightBar } from '@/modules/event-page/bento/NightNotes';
import { nextPublicNight, buildNightHref } from '@/modules/event-page/bento/nextPublicNight';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

const night = (id: string, date: string, isCancelled = false) =>
  ({
    occurrenceId: id,
    localDate: `${date}T19:00` as never,
    startsAt: `${date}T19:00` as never,
    isCancelled,
  }) as unknown as EventPageSnapshotOccurrence;

const nights = [
  night('a', '2026-10-22', true),
  night('b', '2026-10-29'),
  night('c', '2026-11-19'),
  night('d', '2026-11-26'),
  night('e', '2026-12-03'),
];

const src = readFileSync(new URL('./BentoPage.tsx', import.meta.url), 'utf8');

describe('nextPublicNight (rows 3)', () => {
  it('finished night -> next upcoming night, full label, ONE link format', () => {
    const n = nextPublicNight(nights, 'c', 'lux-lounge', '2026-11-25');
    expect(n?.occurrenceId).toBe('d');
    expect(n?.dateLabel).toBe('Thursday 26 November');
    expect(n?.href).toBe(buildNightHref('lux-lounge', 'd'));
    expect(n?.href).toBe('/event/lux-lounge?occurrenceId=d');
  });
  it('cancelled night -> next night that is not cancelled', () => {
    expect(nextPublicNight(nights, 'a', 'x', '2026-10-01')?.dateLabel).toBe('Thursday 29 October');
  });
  it('skips cancelled nights', () => {
    const l = [night('a', '2026-10-22'), night('b', '2026-10-29', true), night('c', '2026-11-05')];
    expect(nextPublicNight(l, 'a', 'x', '2026-10-01')?.occurrenceId).toBe('c');
  });
  it('no next night -> null (button hidden)', () => {
    expect(nextPublicNight(nights, 'e', 'x', '2026-11-25')).toBeNull();
    expect(nextPublicNight(nights, 'c', null, '2026-11-25')).toBeNull();
  });
});

describe('FinishedNightCard (row 1)', () => {
  const next = nextPublicNight(nights, 'c', 'lux', '2026-11-25');
  const html = renderToStaticMarkup(<FinishedNightCard dateLabel="Thursday 19 November" next={next} />);
  it('shows the lines, the button and the specified colours', () => {
    expect(html).toContain('This night has finished');
    expect(html).toContain('Thursday 19 November');
    expect(html).toContain('Go to the next night, Thursday 26 November');
    expect(html).toContain('href="/event/lux?occurrenceId=d"');
    expect(html).toMatch(/#24352c/);
    expect(html).toMatch(/1\.5px solid #5d7a6a/);
    expect(html).toMatch(/background:#f5a623/);
    expect(html).toMatch(/font-weight:800/);
  });
  it('hides the button when there is no next night, keeps the note', () => {
    const h = renderToStaticMarkup(<FinishedNightCard dateLabel="Thursday 19 November" next={null} />);
    expect(h).toContain('This night has finished');
    expect(h).not.toContain('Go to the next night');
  });
});

describe('CancelledNightBar (row 2)', () => {
  const next = nextPublicNight(nights, 'a', 'lux', '2026-10-01');
  it('order: heading, button, reason', () => {
    const h = renderToStaticMarkup(<CancelledNightBar reasonLabel="Venue closed" next={next} />);
    const i = [h.indexOf('This night is cancelled'), h.indexOf('Go to the next night, Thursday 29 October'), h.indexOf('Venue closed')];
    expect(i.every((x) => x >= 0)).toBe(true);
    expect(i).toEqual([...i].sort((a, b) => a - b));
    expect(h).toContain('#dc2626');
    expect(h).toContain('#991b1b');
  });
  it('omits the reason line when none, hides the button when no next night', () => {
    const h = renderToStaticMarkup(<CancelledNightBar reasonLabel={null} next={null} />);
    expect(h).toContain('This night is cancelled');
    expect(h).not.toContain('Go to the next night');
    expect(h).not.toContain('opacity');
  });
});

describe('BentoPage wiring (rows 4-8, flag, keep-list)', () => {
  it('is behind flags.nightNotes and never edits EventCancelledBanner', () => {
    expect(src).toMatch(/flags\.nightNotes/);
    expect(src).not.toMatch(/EventCancelledBanner\.tsx/);
  });
  it('rows 7/8: ended, paused and whole-series cancelled are excluded from night notes', () => {
    expect(src).toMatch(/nightNotesOn = flags\.nightNotes && state === 'ready' && !isEnded && !pageModel\.page\.isPaused/);
    expect(src).toMatch(/nightCancelled = nightNotesOn && !!occurrence\?\.isCancelled && !pageModel\.page\.isCancelled/);
    expect(src).toMatch(/<EventEndedRecord/);
    expect(src).toMatch(/<MoreEventsSection/);
    expect(src).toMatch(/<EventCancelledBanner/);
    expect(src).toMatch(/<EventPausedBanner/);
  });
  it('grey strip never shows on a night-cancelled night', () => {
    expect(src).toMatch(/past && !pageModel\.page\.isPaused && !nightCancelled/);
  });
  it('rows 4/5/6: raffle and bottom bar untouched, tickets hidden once over', () => {
    expect(src).not.toMatch(/nightFinished[^\n]*raffle/);
    expect(src).toMatch(/<EventStickyActionBar/);
    expect(src).toMatch(/over \|\| !!occurrence\?\.isCancelled \|\| pageModel\.page\.isPaused/);
  });
  it('keep-list components are still rendered', () => {
    for (const s of ['<BentoGrid', '<ReportProblemLink', 'buildBreadcrumbs(', 'titleOrange:', 'filter: pageModel.page.isCancelled']) {
      expect(src).toContain(s);
    }
  });
});
