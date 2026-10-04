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
  upcoming_count: 3,
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
    expect(dateLabel('2026-10-06', TODAY)).toBe('Tue 6 Oct');
    expect(dateLabel('2026-11-01', TODAY)).toBe('Sun 1 Nov');
  });
});

describe('attentionItems', () => {
  it('orders a sent-back series first, then review, cancellations, tonight', () => {
    const items = attentionItems(
      [
        series({ id: 'live', next_dates: [date(TODAY), date('2026-10-13', { lifecycle_status: 'cancelled' })] }),
        series({ id: 'review', name: 'Sundays', lifecycle_status: 'pending_review' }),
        series({
          id: 'back',
          name: 'Fridays',
          lifecycle_status: 'rejected',
          latest_decision: { action: 'rejected', to_state: 'rejected', reason: 'Add the venue', created_at: '' },
        }),
      ],
      TODAY,
    );
    expect(items.map((i) => i.kind)).toEqual(['rejected', 'in_review', 'cancelled', 'tonight']);
    expect(items[0].text).toContain('Add the venue');
    expect(items[2].text).toContain('Tue 13 Oct');
    expect(items[3].text).toContain('at 19:30');
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
