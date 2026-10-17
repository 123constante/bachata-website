import { describe, expect, it } from 'vitest';
import { attentionItems, dateLabel, localAsZTime, type HomeSeriesFull } from '../homeModel';

const TODAY = '2026-10-04';

const series = (over: Partial<HomeSeriesFull>): HomeSeriesFull => ({
  id: 's1',
  name: 'Tuesday Bachata Class',
  slug: 'tuesday-bachata-class',
  format: 'recurring',
  category: 'class',
  lifecycle_status: 'live',
  default_local_start_time: '19:00:00',
  default_cover_image_url: null,
  created_at: '2026-09-01T10:00:00+00:00',
  upcoming_count: 3,
  cancelled_upcoming_count: 0,
  next_dates: [],
  latest_decision: null,
  ...over,
});

const date = (occurrence_date: string, over: Partial<HomeSeriesFull['next_dates'][number]> = {}) => ({
  occurrence_id: `o-${occurrence_date}`,
  occurrence_date,
  lifecycle_status: 'scheduled',
  materialised_start_utc: `${occurrence_date}T19:30:00+00:00`,
  has_own_changes: false,
  ...over,
});

describe('localAsZTime', () => {
  it('reads London wall-clock digits without a time-zone shift (BST included)', () => {
    // 4 Oct is BST: a real UTC conversion would print 20:30.
    expect(localAsZTime('2026-10-04T19:30:00+00:00')).toBe('19:30');
    expect(localAsZTime('2026-12-01T09:05:00Z')).toBe('09:05');
    expect(localAsZTime(null)).toBeNull();
  });
});

describe('dateLabel', () => {
  it('names today "Tonight" and formats other London dates', () => {
    expect(dateLabel(TODAY, TODAY)).toBe('Tonight');
    expect(dateLabel('2026-10-06', TODAY)).toBe('Tuesday 6 October');
    expect(dateLabel('2026-11-01', TODAY)).toBe('Sunday 1 November');
  });
});

describe('attentionItems', () => {
  it('lists cancellations, then tonight; no review rows (D4) and no archived series (R3-4)', () => {
    const items = attentionItems(
      [
        series({ id: 'live', next_dates: [date(TODAY), date('2026-10-13', { lifecycle_status: 'cancelled' })] }),
        series({ id: 'gone', lifecycle_status: 'archived', next_dates: [date('2026-10-14', { lifecycle_status: 'cancelled' })] }),
        series({ id: 'old', name: 'Sundays', lifecycle_status: 'pending_review' }),
        series({ id: 'back', name: 'Fridays', lifecycle_status: 'rejected' }),
      ],
      TODAY,
    );
    expect(items.map((i) => [i.kind, i.seriesId])).toEqual([['cancelled', 'live'], ['tonight', 'live']]);
    expect(items[0].text).toContain('Tuesday 13 October');
    expect(items[1].text).toContain('at 19:30');
  });

  it('is empty for a quiet live series', () => {
    expect(attentionItems([series({ next_dates: [date('2026-10-06')] })], TODAY)).toEqual([]);
  });

  it('does not call a cancelled date tonight, nor a non-live series', () => {
    expect(attentionItems([series({ next_dates: [date(TODAY, { lifecycle_status: 'cancelled' })] })], TODAY).map((i) => i.kind))
      .toEqual(['cancelled']);
    expect(attentionItems([series({ lifecycle_status: 'draft', next_dates: [date(TODAY)] })], TODAY)).toEqual([]);
  });
});
