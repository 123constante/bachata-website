// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { rowsOf } from '../../data/home';
import { SHAPES, TODAY, homeOf } from '../../screens/__tests__/fixtures';
import { PAGE_FIRST, buildEvents, type Night, type Seat } from '../eventsModel';
import { EventsView, NightSheet } from '../EventsView';

/**
 * The ONE screen x shape table. Rows = the shapes an organiser's Events tab meets; columns = what the
 * list shows, what the first night's sheet disables and the reason on screen, and the empty-state action.
 * Everything is drawn from the shared model (STATUS_WORD, the WHY reasons): no screen has its own copy.
 */
const dated = (d: string) => ({ occurrence_id: `o-${d}`, occurrence_date: d, lifecycle_status: 'scheduled', materialised_start_utc: `${d}T20:00:00+00:00`, has_own_changes: false, venue_name: null });
const cancelledDate = { ...dated('2026-11-06'), lifecycle_status: 'cancelled' };
const many = Array.from({ length: 30 }, (_, i) => ({ ...SHAPES.tonight, id: `m${i}`, name: `Night ${i}`, upcoming_count: 40, next_dates: [dated('2026-11-06'), dated('2026-11-13')] }));
const allCx = [{ ...SHAPES.tonight, id: 'cx', name: 'Gone Night', upcoming_count: 1, next_dates: [cancelledDate, dated('2026-11-13')] }];

interface Row {
  shape: string; set: unknown[]; seat: Seat;
  /** list rows drawn (ev-night) */ drawn: number;
  /** testid of the empty-state card, or null when the list is drawn */ card: string | null;
  /** testid of the card's action link, or null (view only: none, and why) */ cardAction: string | null;
  /** first night: status word, whether Cancel is disabled and the reason it shows */
  first: { status: string; cancelDisabled: boolean; why: RegExp | null; canDelete: boolean } | null;
  past: boolean;
}
const ROWS: Row[] = [
  { shape: 'empty', set: [], seat: 'owner', drawn: 0, card: 'ev-empty', cardAction: 'ev-empty-new', first: null, past: false },
  { shape: 'empty, contributor', set: [], seat: 'contributor', drawn: 0, card: 'ev-empty', cardAction: null, first: null, past: false },
  { shape: 'drafts only', set: [SHAPES.draft], seat: 'owner', drawn: 1, card: null, cardAction: null, first: { status: 'Draft', cancelDisabled: true, why: /not on the calendar/, canDelete: true }, past: false },
  { shape: 'live', set: [SHAPES.tonight], seat: 'owner', drawn: 2, card: null, cardAction: null, first: { status: 'Live', cancelDisabled: false, why: null, canDelete: false }, past: false },
  { shape: 'hidden', set: [SHAPES.paused], seat: 'owner', drawn: 1, card: null, cardAction: null, first: { status: 'Hidden', cancelDisabled: true, why: /hidden/, canDelete: false }, past: false },
  { shape: 'cancelled', set: allCx, seat: 'owner', drawn: 2, card: null, cardAction: null, first: { status: 'Cancelled', cancelDisabled: true, why: /already cancelled/, canDelete: false }, past: false },
  { shape: 'past only', set: [SHAPES.ended], seat: 'owner', drawn: 0, card: 'ev-allpast', cardAction: 'ev-allpast-new', first: null, past: true },
  { shape: 'past only, contributor', set: [SHAPES.ended], seat: 'contributor', drawn: 0, card: 'ev-allpast', cardAction: null, first: null, past: true },
  { shape: '100+ rows, paged', set: many, seat: 'owner', drawn: PAGE_FIRST, card: null, cardAction: null, first: { status: 'Live', cancelDisabled: false, why: null, canDelete: false }, past: false },
  { shape: 'contributor, live', set: [SHAPES.tonight, SHAPES.draft], seat: 'contributor', drawn: 3, card: null, cardAction: null, first: { status: 'Live', cancelDisabled: true, why: /Contributors/, canDelete: false }, past: false },
  { shape: 'manager, live', set: [SHAPES.tonight, SHAPES.draft], seat: 'manager', drawn: 3, card: null, cardAction: null, first: { status: 'Live', cancelDisabled: false, why: null, canDelete: false }, past: false },
];

afterEach(cleanup);
const modelOf = (r: Row) => buildEvents({ rows: rowsOf(homeOf(r.set as never)), today: TODAY, seat: r.seat, query: '', filter: 'all', shown: PAGE_FIRST, showPast: false });
const noop = () => {};

describe('Events screen x shape (one table)', () => {
  it.each(ROWS)('$shape', (r) => {
    const model = modelOf(r);
    render(<MemoryRouter><EventsView model={model} pageId="org" query="" filter="all" onQuery={noop} onFilter={noop} onClear={noop} onMore={noop} onShowPast={noop} onOpenNight={noop} /></MemoryRouter>);
    // shown
    expect(screen.queryAllByTestId('ev-night')).toHaveLength(r.drawn);
    expect(document.body.textContent).not.toMatch(/undefined|NaN|TO FILL/);
    if (r.card) {
      expect(screen.getByTestId(r.card)).toBeTruthy();
      expect(screen.getByTestId(r.card).textContent).toMatch(r.card === 'ev-allpast' ? /Show past events/ : /New event|owner or a manager/);
    } else {
      expect(screen.queryByTestId('ev-empty')).toBeNull();
      expect(screen.queryByTestId('ev-allpast')).toBeNull();
    }
    // the empty-state action: present for people who can write, absent (with the reason in the card) for a contributor
    if (r.card && r.cardAction) expect(screen.getByTestId(r.cardAction)).toBeTruthy();
    if (r.card && !r.cardAction) {
      expect(screen.queryByTestId(`${r.card}-new`)).toBeNull();
      expect(screen.getByTestId(r.card).textContent).toMatch(/owner or a manager/);
    }
    // a past-only list offers the way back to the past nights
    expect(!!screen.queryByTestId('ev-past')).toBe(r.past);
    // disabled controls: each names its reason on screen
    for (const b of screen.queryAllByRole('button')) {
      if ((b as HTMLButtonElement).disabled) {
        const id = b.getAttribute('aria-describedby') ?? '';
        expect(id).not.toBe('');
        expect(document.getElementById(id)?.textContent ?? '').not.toBe('');
      }
    }
    expect(model.viewOnly).toBe(r.seat === 'contributor');
    cleanup();

    // the first night's sheet
    if (!r.first) return;
    const night: Night = model.nights[0];
    render(<MemoryRouter><NightSheet night={night} onClose={noop} onCancel={noop} onDelete={noop} openTo="/x" /></MemoryRouter>);
    expect(screen.getByTestId('ev-sheet-status').textContent).toContain(r.first.status);
    const cancel = screen.getByTestId('ev-cancel') as HTMLButtonElement;
    expect(cancel.disabled).toBe(r.first.cancelDisabled);
    if (r.first.why) {
      expect(screen.getByTestId('ev-cancel-why').textContent).toMatch(r.first.why);
      expect(cancel.getAttribute('aria-describedby')).toBe(screen.getByTestId('ev-cancel-why').id);
    } else expect(cancel.getAttribute('aria-describedby')).toBeNull();
    expect(!!screen.queryByTestId('ev-delete')).toBe(r.first.canDelete);
    // Duplicate has no command: always disabled, always with its reason
    const dup = screen.getByTestId('ev-duplicate') as HTMLButtonElement;
    expect(dup.disabled).toBe(true);
    expect(dup.getAttribute('aria-describedby')).toBe(screen.getByTestId('ev-duplicate-why').id);
  });
});
