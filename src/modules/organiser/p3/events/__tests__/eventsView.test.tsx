// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { rowsOf } from '../../data/home';
import { SHAPES, TODAY, homeOf } from '../../screens/__tests__/fixtures';
import { PAGE_FIRST, buildEvents, type Filter, type Night, type Seat } from '../eventsModel';
import { EventsView, NightSheet } from '../EventsView';

afterEach(cleanup);
const dated = (d: string) => ({ occurrence_id: `o-${d}`, occurrence_date: d, lifecycle_status: 'scheduled', materialised_start_utc: `${d}T20:00:00+00:00`, has_own_changes: false, venue_name: null });
const many = Array.from({ length: 30 }, (_, i) => ({ ...SHAPES.tonight, id: `m${i}`, name: `Night ${i}`, upcoming_count: 40, next_dates: [dated('2026-11-06'), dated('2026-11-13')] }));

function draw(set: unknown[], seat: Seat = 'owner', over: { query?: string; filter?: Filter; shown?: number } = {}) {
  const rows = rowsOf(homeOf(set as never));
  const model = buildEvents({ rows, today: TODAY, seat, query: over.query ?? '', filter: over.filter ?? 'all', shown: over.shown ?? PAGE_FIRST, showPast: false });
  render(<MemoryRouter><EventsView model={model} pageId="org" query={over.query ?? ''} filter={over.filter ?? 'all'} onQuery={() => {}} onFilter={() => {}} onClear={() => {}} onMore={() => {}} onShowPast={() => {}} onOpenNight={() => {}} /></MemoryRouter>);
  return model;
}

describe('Events view x shape', () => {
  // The screen x shape table lives in eventsMatrix.test.tsx.
  it('empty says what to do and offers New event twice (header and card)', () => {
    draw([]);
    expect(screen.getByTestId('ev-empty').textContent).toMatch(/New event/);
    expect(screen.getByTestId('ev-empty-new')).toBeTruthy();
  });

  it('222-date organiser: 15 rows, Showing 15 of N, Show 30 more, search and filter chips', () => {
    const m = draw(many);
    expect(screen.getAllByTestId('ev-night')).toHaveLength(PAGE_FIRST);
    expect(screen.getByTestId('ev-showing').textContent).toBe(`Showing ${PAGE_FIRST} of ${m.total}`);
    expect(screen.getByTestId('ev-more').textContent).toBe('Show 30 more');
    expect(screen.getByTestId('ev-q')).toBeTruthy();
    expect(screen.getByTestId('ev-filter-live').textContent).toMatch(/Live 60/);
  });

  it('a series with unseen dates links to the existing All dates screen', () => {
    draw([SHAPES.tonight]);
    const link = screen.getByTestId('ev-more-dates');
    expect(link.getAttribute('href')).toBe('/account/p3/events/tonight/dates');
    expect(link.textContent).toBe('See 6 more dates of Tonight Social');
  });

  it('contributor: banner, New event disabled with the banner as its reason, no Needs button', () => {
    draw([SHAPES.draft, SHAPES.tonight], 'contributor');
    expect(screen.getByTestId('ev-banner').textContent).toMatch(/contributor/);
    const btn = screen.getByTestId('ev-new') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-describedby')).toBe(screen.getByTestId('ev-banner').id);
    fireEvent.click(screen.getByTestId('ev-needs-see'));
    expect(screen.queryByTestId('ev-need-action')).toBeNull();
    expect(screen.getAllByTestId('ev-need-note')[0].textContent).toMatch(/needs to finish this/);
  });

  it('owner: the pinned strip is one line and its sheet gives each item one button', () => {
    draw([SHAPES.draft]);
    expect(screen.getByTestId('ev-needs-line').textContent).toMatch(/things? need(s)? you/);
    fireEvent.click(screen.getByTestId('ev-needs-see'));
    expect(within(screen.getByTestId('p3-sheet')).getAllByTestId('ev-need-action').length).toBeGreaterThan(0);
  });

  it('night sheet: draft offers Delete draft and says why Cancel is off; live offers Cancel; Duplicate is off with a reason', () => {
    const night = (set: unknown[]): Night => buildEvents({ rows: rowsOf(homeOf(set as never)), today: TODAY, seat: 'owner', query: '', filter: 'all', shown: 15, showPast: false }).nights[0];
    const sheet = (n: Night) => render(<MemoryRouter><NightSheet night={n} onClose={() => {}} onCancel={() => {}} onDelete={() => {}} openTo="/x" /></MemoryRouter>);
    sheet(night([SHAPES.draft]));
    expect(screen.getByTestId('ev-delete')).toBeTruthy();
    expect((screen.getByTestId('ev-cancel') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('ev-cancel-why').textContent).toMatch(/not on the calendar/);
    expect((screen.getByTestId('ev-duplicate') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('ev-duplicate-why').textContent).toMatch(/not available yet/);
    cleanup();
    sheet(night([SHAPES.tonight]));
    expect((screen.getByTestId('ev-cancel') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('ev-delete')).toBeNull();
  });
});
